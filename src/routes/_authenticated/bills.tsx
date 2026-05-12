import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Receipt, Check, Trash2, Pencil } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/bills")({ component: BillsPage });

type Bill = {
  id: string; name: string; category: string | null; amount_cents: number;
  due_date: string | null; recurring: string; notes: string | null;
  paid: boolean; paid_on: string | null;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function BillsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);

  const { data: bills } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("paid").order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Bill[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Record<string, unknown> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("bills").update(rest as never).eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills").insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bills"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("bills").update({ paid, paid_on: paid ? new Date().toISOString().slice(0, 10) : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("bills").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });

  const totalUnpaid = (bills ?? []).filter((b) => !b.paid).reduce((s, b) => s + Number(b.amount_cents), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Bills</h1>
          <p className="text-muted-foreground">Outstanding: <strong>{fmt(totalUnpaid)}</strong></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add bill</Button></DialogTrigger>
          <BillForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      {(bills ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No bills yet.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {bills?.map((b) => {
              const overdue = !b.paid && b.due_date && isBefore(new Date(b.due_date), new Date());
              return (
                <li key={b.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${b.paid ? "line-through text-muted-foreground" : ""}`}>{b.name}</span>
                      {b.category && <Badge variant="secondary">{b.category}</Badge>}
                      {b.recurring !== "none" && <Badge variant="outline">{b.recurring}</Badge>}
                      {overdue && <Badge variant="destructive">overdue</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.due_date ? `Due ${format(new Date(b.due_date), "MMM d, yyyy")}` : "No due date"}
                      {b.paid && b.paid_on && ` · Paid ${format(new Date(b.paid_on), "MMM d")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmt(b.amount_cents)}</span>
                    <Button size="sm" variant={b.paid ? "ghost" : "outline"} onClick={() => togglePaid.mutate({ id: b.id, paid: !b.paid })}>
                      <Check className="h-4 w-4" /> {b.paid ? "Unpay" : "Mark paid"}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmDelete
                      trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
                      title={`Delete ${b.name}?`}
                      onConfirm={() => del.mutate(b.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <BillForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function BillForm({ initial, onSubmit, submitting }: { initial?: Bill; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    amount: initial ? (initial.amount_cents / 100).toFixed(2) : "",
    due_date: initial?.due_date ?? "",
    recurring: initial?.recurring ?? "none",
    notes: initial?.notes ?? "",
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit bill" : "Add bill"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit({ name: f.name, category: f.category || null, amount_cents: Math.round(Number(f.amount || 0) * 100), due_date: f.due_date || null, recurring: f.recurring, notes: f.notes || null }); }} className="space-y-3">
        <div><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={100} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="utilities" maxLength={50} /></div>
          <div><Label>Amount ($)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          <div><Label>Due date</Label><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
          <div>
            <Label>Recurring</Label>
            <Select value={f.recurring} onValueChange={(v) => setF({ ...f, recurring: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">One-time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
