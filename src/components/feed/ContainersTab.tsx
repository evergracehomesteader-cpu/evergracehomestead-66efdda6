import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Box, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { usePermissions } from "@/hooks/usePermissions";

type Container = { id: string; name: string; capacity_lbs: number | null; location: string | null; notes: string | null; active: boolean };
type Stock = { container_id: string; feed_item_id: string; stock_lbs: number };
type FeedItem = { id: string; name: string };
type Unit = { id: string; name: string; lbs_per_unit: number };

const BAG_LBS = 50;
const BUCKET_LBS = 25;

export function ContainersTab() {
  const qc = useQueryClient();
  const { hasRole } = usePermissions();
  const canManage = hasRole("admin") || hasRole("manager");
  const [editing, setEditing] = useState<Container | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [addStockTo, setAddStockTo] = useState<Container | null>(null);

  const { data: containers = [] } = useQuery({
    queryKey: ["feed-containers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_containers" as never).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Container[];
    },
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["feed-container-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_container_stock" as never).select("container_id,feed_item_id,stock_lbs");
      return (data ?? []) as unknown as Stock[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["feed-items-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_items").select("id,name");
      return (data ?? []) as FeedItem[];
    },
  });
  const { data: units = [] } = useQuery({
    queryKey: ["feed-units"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_units" as never).select("id,name,lbs_per_unit").order("lbs_per_unit", { ascending: false });
      return (data ?? []) as unknown as Unit[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Container> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { error } = await supabase.from("feed_containers" as never).update(p as never).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_containers" as never).insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-containers"] }); toast.success("Saved"); setEditing(null); setOpenNew(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("feed_containers" as never).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-containers"] }); toast.success("Deleted"); },
  });

  const addStock = useMutation({
    mutationFn: async (p: { container_id: string; feed_item_id: string; total_lbs: number; unit_type: "bag" | "lbs" | "custom_unit"; bag_size_lbs: number | null; bag_count: number | null; custom_unit_id: string | null; custom_unit_qty: number | null; notes: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("feed_purchases").insert({
        feed_item_id: p.feed_item_id,
        container_id: p.container_id,
        unit_type: p.unit_type,
        bag_size_lbs: p.bag_size_lbs,
        bag_count: p.bag_count,
        custom_unit_id: p.custom_unit_id,
        custom_unit_qty: p.custom_unit_qty,
        total_lbs: p.total_lbs,
        quantity: p.total_lbs,
        price_cents: 0,
        notes: p.notes,
        created_by: u.user?.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-container-stock"] });
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      toast.success("Stock added");
      setAddStockTo(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Physical storage locations (barrels, bins, bags).</p>
        {canManage && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add container</Button></DialogTrigger>
            <ContainerForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
          </Dialog>
        )}
      </div>
      {containers.length === 0 ? (
        <Card className="p-12 text-center">
          <Box className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No containers yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {containers.map((c) => {
            const contents = stock.filter((s) => s.container_id === c.id && s.stock_lbs > 0);
            const total = contents.reduce((a, s) => a + Number(s.stock_lbs), 0);
            const pct = c.capacity_lbs ? Math.min(100, (total / Number(c.capacity_lbs)) * 100) : null;
            const cap = c.capacity_lbs ? Number(c.capacity_lbs) : null;
            return (
              <Card key={c.id} className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    {c.location && <div className="text-xs text-muted-foreground">{c.location}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" title="Add stock" onClick={() => setAddStockTo(c)}><PackagePlus className="h-4 w-4" /></Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3 w-3" /></Button>
                        <ConfirmDelete trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                          title={`Delete ${c.name}?`} onConfirm={() => del.mutate(c.id)} />
                      </>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-display font-semibold leading-tight">{total.toFixed(1)} <span className="text-xs text-muted-foreground">lb</span></div>
                <div className="text-xs text-muted-foreground">
                  {(total / BAG_LBS).toFixed(2)} bags · {(total / BUCKET_LBS).toFixed(2)} buckets
                </div>
                {pct != null && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {cap && (
                  <div className="text-xs text-muted-foreground">
                    capacity {cap.toFixed(0)} lb · {(cap / BAG_LBS).toFixed(1)} bags · {(cap / BUCKET_LBS).toFixed(1)} buckets
                  </div>
                )}
                {contents.length > 0 && (
                  <ul className="text-xs space-y-0.5 mt-1">
                    {contents.map((s) => {
                      const name = items.find((i) => i.id === s.feed_item_id)?.name ?? "(unknown)";
                      const lbs = Number(s.stock_lbs);
                      return (
                        <li key={s.feed_item_id} className="flex justify-between gap-2">
                          <span className="truncate">{name}</span>
                          <span className="whitespace-nowrap">{lbs.toFixed(1)} lb · {(lbs / BAG_LBS).toFixed(2)} bag · {(lbs / BUCKET_LBS).toFixed(2)} bkt</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <ContainerForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
      {addStockTo && (
        <Dialog open onOpenChange={(o) => !o && setAddStockTo(null)}>
          <AddStockForm
            container={addStockTo}
            items={items}
            units={units}
            onSubmit={(p) => addStock.mutate(p)}
            submitting={addStock.isPending}
          />
        </Dialog>
      )}
    </div>
  );
}

function ContainerForm({ initial, onSubmit, submitting }: { initial?: Container; onSubmit: (p: Partial<Container>) => void; submitting: boolean }) {
  const [f, setF] = useState<Partial<Container>>(initial ?? { name: "", capacity_lbs: null, location: "", notes: "", active: true });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit container" : "Add container"}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit(f); }}>
        <div><Label>Name *</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blue Barrel" maxLength={100} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Capacity (lb)</Label><Input type="number" step="0.1" value={f.capacity_lbs ?? ""} onChange={(e) => setF({ ...f, capacity_lbs: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Location</Label><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Barn" maxLength={100} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

type AddStockPayload = {
  container_id: string;
  feed_item_id: string;
  total_lbs: number;
  unit_type: "bag" | "lbs" | "custom_unit";
  bag_size_lbs: number | null;
  bag_count: number | null;
  custom_unit_id: string | null;
  custom_unit_qty: number | null;
  notes: string | null;
};

function AddStockForm({ container, items, units, onSubmit, submitting }: {
  container: Container;
  items: FeedItem[];
  units: Unit[];
  onSubmit: (p: AddStockPayload) => void;
  submitting: boolean;
}) {
  const [feedId, setFeedId] = useState<string>(items[0]?.id ?? "");
  // unit selector value: "__lbs__" | "__bag__" | <unit.id>
  const bagUnit = useMemo(() => units.find((u) => /^bag$/i.test(u.name)), [units]);
  const [unitSel, setUnitSel] = useState<string>(bagUnit ? "__bag__" : "__lbs__");
  const [bagSize, setBagSize] = useState("50");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");

  const totalLbs = useMemo(() => {
    const n = Number(qty || 0);
    if (unitSel === "__lbs__") return n;
    if (unitSel === "__bag__") return n * Number(bagSize || 0);
    const u = units.find((x) => x.id === unitSel);
    return n * (u?.lbs_per_unit ?? 0);
  }, [qty, unitSel, bagSize, units]);

  const submit = () => {
    if (!feedId) { toast.error("Pick a feed"); return; }
    if (totalLbs <= 0) { toast.error("Enter an amount"); return; }
    let payload: AddStockPayload;
    if (unitSel === "__bag__") {
      payload = {
        container_id: container.id, feed_item_id: feedId, total_lbs: totalLbs,
        unit_type: "bag", bag_size_lbs: Number(bagSize), bag_count: Number(qty),
        custom_unit_id: null, custom_unit_qty: null, notes: notes || null,
      };
    } else if (unitSel === "__lbs__") {
      payload = {
        container_id: container.id, feed_item_id: feedId, total_lbs: totalLbs,
        unit_type: "lbs", bag_size_lbs: null, bag_count: null,
        custom_unit_id: null, custom_unit_qty: null, notes: notes || null,
      };
    } else {
      payload = {
        container_id: container.id, feed_item_id: feedId, total_lbs: totalLbs,
        unit_type: "custom_unit", bag_size_lbs: null, bag_count: null,
        custom_unit_id: unitSel, custom_unit_qty: Number(qty), notes: notes || null,
      };
    }
    onSubmit(payload);
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add stock to {container.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Feed *</Label>
          <Select value={feedId} onValueChange={setFeedId}>
            <SelectTrigger><SelectValue placeholder="Pick feed" /></SelectTrigger>
            <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount</Label><Input type="number" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div>
            <Label>Unit</Label>
            <Select value={unitSel} onValueChange={setUnitSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__bag__">Bags</SelectItem>
                <SelectItem value="__lbs__">Pounds</SelectItem>
                {units.filter((u) => !/^bag$/i.test(u.name)).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.lbs_per_unit} lb)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {unitSel === "__bag__" && (
          <div><Label>Bag size (lb)</Label><Input type="number" step="0.1" value={bagSize} onChange={(e) => setBagSize(e.target.value)} /></div>
        )}
        <div className="rounded-md border p-3 text-sm flex justify-between">
          <span className="text-muted-foreground">Total added:</span>
          <span className="font-semibold">{totalLbs.toFixed(1)} lb · {(totalLbs / BAG_LBS).toFixed(2)} bags · {(totalLbs / BUCKET_LBS).toFixed(2)} buckets</span>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button onClick={submit} disabled={submitting}>Add to container</Button></DialogFooter>
      </div>
    </DialogContent>
  );
}
