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
import { Plus, Egg, Milk, Beef, Sprout, Recycle, PawPrint, Trash2, Pencil } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subDays } from "date-fns";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/production")({ component: ProductionPage });

type Prod = {
  id: string; animal_id: string | null; group_label: string | null;
  product_type: string; quantity: number; unit: string; produced_on: string;
  value_cents: number; notes: string | null;
};

const TYPES = [
  { v: "eggs", label: "Eggs", icon: Egg, unit: "ea" },
  { v: "milk", label: "Milk", icon: Milk, unit: "qt" },
  { v: "meat", label: "Meat", icon: Beef, unit: "lb" },
  { v: "offspring", label: "Offspring", icon: PawPrint, unit: "ea" },
  { v: "harvest", label: "Harvest", icon: Sprout, unit: "lb" },
  { v: "compost", label: "Compost", icon: Recycle, unit: "yd³" },
] as const;

type SbAny = {
  from: (t: string) => {
    select: (s: string) => { order: (c: string, o?: { ascending: boolean }) => Promise<{ data: Prod[] | null }> };
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
  };
};

function ProductionPage() {
  const qc = useQueryClient();
  const sb = supabase as unknown as SbAny;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prod | null>(null);
  const [defaultType, setDefaultType] = useState<string>("eggs");
  const [filter, setFilter] = useState<string>("all");

  const { data: logs } = useQuery({
    queryKey: ["prod"],
    queryFn: async () => (await sb.from("production_logs").select("*").order("produced_on", { ascending: false })).data ?? [],
  });
  const { data: animals } = useQuery({
    queryKey: ["prod-animals"],
    queryFn: async () => (await supabase.from("animals").select("id,name").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (p: Omit<Prod, "id"> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await sb.from("production_logs").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("production_logs").insert({ ...p, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prod"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb.from("production_logs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prod"] }),
  });

  const filtered = useMemo(() => (logs ?? []).filter((l) => filter === "all" || l.product_type === filter), [logs, filter]);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthTotals = useMemo(() => {
    const m = new Map<string, { qty: number; unit: string }>();
    (logs ?? []).forEach((l) => {
      if (!isWithinInterval(parseISO(l.produced_on), { start: monthStart, end: monthEnd })) return;
      const cur = m.get(l.product_type) ?? { qty: 0, unit: l.unit };
      cur.qty += Number(l.quantity);
      m.set(l.product_type, cur);
    });
    return m;
  }, [logs]);

  const trend = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      const total = (filtered ?? []).filter((l) => l.produced_on === key).reduce((s, l) => s + Number(l.quantity), 0);
      days.push({ date: format(d, "M/d"), total });
    }
    return days;
  }, [filtered]);

  const animalName = (id: string | null) => animals?.find((a) => a.id === id)?.name;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Production</h1>
          <p className="text-muted-foreground">Eggs, milk, meat, harvests, compost.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TYPES.map((t) => {
          const v = monthTotals.get(t.v);
          return (
            <Card key={t.v} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setDefaultType(t.v); setOpen(true); }}>
              <div className="flex items-center gap-2 mb-1">
                <t.icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">{t.label}</span>
              </div>
              <div className="text-lg font-display font-semibold">{v ? `${v.qty} ${v.unit}` : "—"}</div>
              <div className="text-[10px] text-muted-foreground">this month</div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-2">Last 30 days {filter !== "all" && `· ${filter}`}</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        {TYPES.map((t) => (
          <Button key={t.v} size="sm" variant={filter === t.v ? "default" : "outline"} onClick={() => setFilter(t.v)}><t.icon className="h-3 w-3" /> {t.label}</Button>
        ))}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="ml-auto"><Plus className="h-4 w-4" /> Log production</Button></DialogTrigger>
          <ProductionForm defaultType={defaultType} animals={animals ?? []} onSubmit={(p) => create.mutate(p)} submitting={create.isPending} />
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm">No entries yet.</Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {filtered.map((l) => {
              const t = TYPES.find((x) => x.v === l.product_type);
              const Icon = t?.icon ?? Sprout;
              return (
                <li key={l.id} className="px-4 py-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{l.quantity} {l.unit} <span className="capitalize text-muted-foreground font-normal">· {l.product_type}</span></div>
                    <div className="text-xs text-muted-foreground truncate">
                      {format(parseISO(l.produced_on), "MMM d")}
                      {l.animal_id && ` · ${animalName(l.animal_id) ?? ""}`}
                      {l.group_label && ` · ${l.group_label}`}
                      {l.value_cents > 0 && ` · $${(l.value_cents / 100).toFixed(2)}`}
                    </div>
                  </div>
                  <ConfirmDelete trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>} onConfirm={() => del.mutate(l.id)} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ProductionForm({ defaultType, animals, onSubmit, submitting }: { defaultType: string; animals: { id: string; name: string }[]; onSubmit: (p: Omit<Prod, "id">) => void; submitting: boolean }) {
  const [type, setType] = useState(defaultType);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<string>(TYPES.find((t) => t.v === defaultType)?.unit ?? "ea");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [animal, setAnimal] = useState("none");
  const [group, setGroup] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Log production</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!qty) { toast.error("Quantity required"); return; }
          onSubmit({
            product_type: type, quantity: Number(qty), unit, produced_on: date,
            animal_id: animal === "none" ? null : animal, group_label: group || null,
            value_cents: value ? Math.round(Number(value) * 100) : 0, notes: notes || null,
          });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); const t = TYPES.find((x) => x.v === v); if (t) setUnit(t.unit); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Quantity *</Label><Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
          <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} /></div>
          <div className="col-span-2">
            <Label>Animal (optional)</Label>
            <Select value={animal} onValueChange={setAnimal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— group / unattributed</SelectItem>
                {animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Group label (e.g. "main flock")</Label><Input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={100} /></div>
          <div><Label>Value ($)</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
