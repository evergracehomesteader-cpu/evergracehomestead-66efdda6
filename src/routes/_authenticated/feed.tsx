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
import { Plus, Wheat, ShoppingCart, Trash2, Pencil, Calculator } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { useMemo } from "react";
import { SearchBar } from "@/components/SearchFilter";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/feed")({ component: FeedPage });

type FeedItem = {
  id: string; name: string; store: string | null; price_cents: number | null;
  unit: string; stock_qty: number; low_stock_threshold: number; notes: string | null;
  species_for: string | null; package_size: number | null;
};
type Purchase = { id: string; feed_item_id: string; store: string | null; price_cents: number; quantity: number; purchased_on: string; notes: string | null };

const fmt = (cents: number | null) => cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

function FeedPage() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<FeedItem | null>(null);
  const [search, setSearch] = useState("");

  const { data: items } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_items").select("*").order("name");
      if (error) throw error;
      return data as FeedItem[];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_purchases").select("*").order("purchased_on", { ascending: false }).limit(20);
      return (data ?? []) as Purchase[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["feed-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_logs").select("feed_item_id,quantity,fed_on").order("fed_on", { ascending: false }).limit(500);
      return (data ?? []) as { feed_item_id: string; quantity: number; fed_on: string }[];
    },
  });

  // Daily usage rate per item from last 30 days of logs
  const usageByItem = useMemo(() => {
    const m = new Map<string, number>(); // qty/day
    const now = new Date();
    const grouped = new Map<string, { qty: number; firstDay: string }>();
    (logs ?? []).forEach((l) => {
      const days = differenceInDays(now, parseISO(l.fed_on));
      if (days > 30) return;
      const cur = grouped.get(l.feed_item_id) ?? { qty: 0, firstDay: l.fed_on };
      cur.qty += Number(l.quantity);
      if (l.fed_on < cur.firstDay) cur.firstDay = l.fed_on;
      grouped.set(l.feed_item_id, cur);
    });
    grouped.forEach((v, k) => {
      const span = Math.max(1, differenceInDays(now, parseISO(v.firstDay)) || 1);
      m.set(k, v.qty / span);
    });
    return m;
  }, [logs]);

  const filteredItems = useMemo(() => {
    if (!search) return items ?? [];
    const q = search.toLowerCase();
    return (items ?? []).filter((f) =>
      f.name.toLowerCase().includes(q) ||
      (f.store ?? "").toLowerCase().includes(q) ||
      (f.species_for ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);


  const save = useMutation({
    mutationFn: async (p: Partial<FeedItem> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { error } = await supabase.from("feed_items").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_items").insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed"] }); toast.success("Saved"); setEditItem(null); setNewOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("feed_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed"] }); toast.success("Deleted"); },
  });

  const addPurchase = useMutation({
    mutationFn: async (p: { feed_item_id: string; store: string | null; price_cents: number; quantity: number; purchased_on: string; notes: string | null; addToStock: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { addToStock, ...insert } = p;
      const { error } = await supabase.from("feed_purchases").insert({ ...insert, created_by: u.user?.id });
      if (error) throw error;
      if (addToStock && purchaseFor) {
        await supabase.from("feed_items").update({
          stock_qty: Number(purchaseFor.stock_qty) + Number(p.quantity),
          price_cents: p.price_cents,
          store: p.store,
        }).eq("id", purchaseFor.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Purchase logged");
      setPurchaseFor(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Feed</h1>
          <p className="text-muted-foreground">Stock, prices, and where you bought it.</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add feed item</Button></DialogTrigger>
          <FeedItemForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search feed by name, store, species…" />

      {(items ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Wheat className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No feed items yet. Add a feed product to track stock.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((f) => {
            const low = Number(f.low_stock_threshold) > 0 && Number(f.stock_qty) <= Number(f.low_stock_threshold);
            const dailyUse = usageByItem.get(f.id) ?? 0;
            const daysLeft = dailyUse > 0 ? Math.floor(Number(f.stock_qty) / dailyUse) : null;
            const monthlyCost = dailyUse > 0 && f.price_cents != null ? (dailyUse * 30 * (f.price_cents / 100)) : null;
            return (
              <Card key={f.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {f.store ? f.store : "—"}{f.species_for ? ` · for ${f.species_for}` : ""}
                    </div>
                  </div>
                  {low && <Badge variant="outline" className="border-warning text-warning">low</Badge>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-display font-semibold">{f.stock_qty}</span>
                  <span className="text-xs text-muted-foreground">{f.unit}</span>
                </div>
                <div className="text-sm text-muted-foreground">{fmt(f.price_cents)} per {f.unit}</div>

                {(dailyUse > 0 || daysLeft != null) && (
                  <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <Calculator className="h-3 w-3" /> Usage
                    </div>
                    <div>~{dailyUse.toFixed(2)} {f.unit}/day</div>
                    {daysLeft != null && (
                      <div className={daysLeft < 7 ? "text-warning font-medium" : "text-muted-foreground"}>
                        ~{daysLeft} day{daysLeft === 1 ? "" : "s"} of stock left
                      </div>
                    )}
                    {monthlyCost != null && <div>~${monthlyCost.toFixed(2)}/mo at this rate</div>}
                  </div>
                )}

                <div className="flex gap-1 mt-auto pt-2">
                  <Button size="sm" variant="outline" onClick={() => setPurchaseFor(f)}><ShoppingCart className="h-3 w-3" /> Buy</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditItem(f)}><Pencil className="h-3 w-3" /></Button>
                  <ConfirmDelete
                    trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                    title={`Delete ${f.name}?`}
                    onConfirm={() => del.mutate(f.id)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {purchases && purchases.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-semibold mb-3">Recent purchases</h2>
          <Card>
            <ul className="divide-y">
              {purchases.map((p) => {
                const item = items?.find((i) => i.id === p.feed_item_id);
                return (
                  <li key={p.id} className="px-4 py-3 flex items-center justify-between text-sm flex-wrap gap-2">
                    <div>
                      <div className="font-medium">{item?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(p.purchased_on), "MMM d, yyyy")} · {p.store ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div>{fmt(p.price_cents)}</div>
                      <div className="text-xs text-muted-foreground">qty {p.quantity}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {editItem && (
        <Dialog open onOpenChange={(o) => !o && setEditItem(null)}>
          <FeedItemForm initial={editItem} onSubmit={(p) => save.mutate({ ...p, id: editItem.id })} submitting={save.isPending} />
        </Dialog>
      )}

      {purchaseFor && (
        <Dialog open onOpenChange={(o) => !o && setPurchaseFor(null)}>
          <PurchaseForm item={purchaseFor} onSubmit={(p) => addPurchase.mutate(p)} submitting={addPurchase.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function FeedItemForm({ initial, onSubmit, submitting }: { initial?: FeedItem; onSubmit: (p: Partial<FeedItem>) => void; submitting: boolean }) {
  const [f, setF] = useState<Partial<FeedItem>>(initial ?? { name: "", store: "", unit: "lb", stock_qty: 0, low_stock_threshold: 0, price_cents: 0 });
  const [priceDollars, setPriceDollars] = useState(initial ? ((initial.price_cents ?? 0) / 100).toFixed(2) : "");
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit feed item" : "Add feed item"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit({ ...f, price_cents: Math.round(Number(priceDollars || 0) * 100) }); }} className="space-y-3">
        <div><Label>Product name *</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Layer Pellets 50lb" required maxLength={150} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Store</Label><Input value={f.store ?? ""} onChange={(e) => setF({ ...f, store: e.target.value })} placeholder="Tractor Supply" maxLength={100} /></div>
          <div><Label>Used for (species)</Label><Input value={f.species_for ?? ""} onChange={(e) => setF({ ...f, species_for: e.target.value })} placeholder="chickens, goats" maxLength={100} /></div>
          <div><Label>Price ($)</Label><Input type="number" step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} /></div>
          <div><Label>Unit</Label><Input value={f.unit ?? "lb"} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={20} /></div>
          <div><Label>Package size</Label><Input type="number" step="0.1" value={f.package_size ?? ""} onChange={(e) => setF({ ...f, package_size: e.target.value ? Number(e.target.value) : null })} placeholder="50" /></div>
          <div><Label>Stock qty</Label><Input type="number" step="0.1" value={f.stock_qty ?? 0} onChange={(e) => setF({ ...f, stock_qty: Number(e.target.value) })} /></div>
          <div className="col-span-2"><Label>Low stock alert at</Label><Input type="number" step="0.1" value={f.low_stock_threshold ?? 0} onChange={(e) => setF({ ...f, low_stock_threshold: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function PurchaseForm({ item, onSubmit, submitting }: { item: FeedItem; onSubmit: (p: { feed_item_id: string; store: string | null; price_cents: number; quantity: number; purchased_on: string; notes: string | null; addToStock: boolean }) => void; submitting: boolean }) {
  const [store, setStore] = useState(item.store ?? "");
  const [price, setPrice] = useState(((item.price_cents ?? 0) / 100).toFixed(2));
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [addToStock, setAddToStock] = useState(true);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log purchase: {item.name}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ feed_item_id: item.id, store: store || null, price_cents: Math.round(Number(price) * 100), quantity: Number(qty), purchased_on: date, notes: notes || null, addToStock }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Store</Label><Input value={store} onChange={(e) => setStore(e.target.value)} maxLength={100} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Price ($)</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
          <div><Label>Quantity</Label><Input type="number" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} />
          Add quantity to stock and update price/store
        </label>
        <DialogFooter><Button type="submit" disabled={submitting}>Log purchase</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
