import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Wheat, ShoppingCart, Trash2, Pencil, Utensils } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SearchBar } from "@/components/SearchFilter";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { PurchaseDialog, type PurchasePayload } from "@/components/feed/PurchaseDialog";
import { FeedingDialog, type FeedingPayload, type AnimalLite } from "@/components/feed/FeedingDialog";
import { ContainersTab } from "@/components/feed/ContainersTab";
import { UnitsTab } from "@/components/feed/UnitsTab";
import { FeedReportsTab } from "@/components/feed/FeedReportsTab";

export const Route = createFileRoute("/_authenticated/feed")({ component: FeedPage });

type FeedItem = {
  id: string; name: string; store: string | null; price_cents: number | null;
  unit: string; stock_qty: number; low_stock_threshold: number; notes: string | null;
  species_for: string | null; package_size: number | null;
};
type Purchase = { id: string; feed_item_id: string; store: string | null; price_cents: number; quantity: number; purchased_on: string; total_lbs: number | null; container_id: string | null };
type Container = { id: string; name: string };
type Unit = { id: string; name: string; lbs_per_unit: number };
type Stock = { container_id: string; feed_item_id: string; stock_lbs: number };

const fmt = (cents: number | null) => cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

function FeedPage() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<FeedItem | null>(null);
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_items").select("*").order("name");
      if (error) throw error;
      return data as FeedItem[];
    },
  });
  const { data: containers = [] } = useQuery({
    queryKey: ["feed-containers"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_containers" as never).select("id,name").order("name");
      return (data ?? []) as unknown as Container[];
    },
  });
  const { data: units = [] } = useQuery({
    queryKey: ["feed-units"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_units" as never).select("id,name,lbs_per_unit").order("name");
      return (data ?? []) as unknown as Unit[];
    },
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["feed-container-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_container_stock" as never).select("container_id,feed_item_id,stock_lbs");
      return (data ?? []) as unknown as Stock[];
    },
  });
  const { data: animals = [] } = useQuery({
    queryKey: ["animals-for-feeding"],
    queryFn: async () => {
      const { data } = await supabase.from("animals").select("id,name,species,breed,current_pen").eq("status", "active").order("name");
      return (data ?? []) as AnimalLite[];
    },
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_purchases").select("*").order("purchased_on", { ascending: false }).limit(20);
      return (data ?? []) as unknown as Purchase[];
    },
  });

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((f) => f.name.toLowerCase().includes(q) || (f.store ?? "").toLowerCase().includes(q) || (f.species_for ?? "").toLowerCase().includes(q));
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
    mutationFn: async (p: PurchasePayload) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("feed_purchases").insert({ ...p, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["feed-container-stock"] });
      toast.success("Purchase logged");
      setPurchaseFor(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addFeeding = useMutation({
    mutationFn: async (p: FeedingPayload) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("feed_logs").insert({ ...p, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed-container-stock"] });
      qc.invalidateQueries({ queryKey: ["feed-logs-all"] });
      toast.success("Feeding logged");
      setFeedingOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-display font-semibold">Feed</h1>
          <p className="text-muted-foreground">Inventory, containers, and feeding logs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFeedingOpen(true)} disabled={items.length === 0 || containers.length === 0}>
            <Utensils className="h-4 w-4" /> Log feeding
          </Button>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add feed</Button></DialogTrigger>
            <FeedItemForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Search feed by name, store, species…" />
          {containers.length === 0 && (
            <Card className="p-4 border-warning/40 bg-warning/5 text-sm">
              No storage containers yet. Add one in the <b>Containers</b> tab before logging purchases.
            </Card>
          )}
          {items.length === 0 ? (
            <Card className="p-12 text-center">
              <Wheat className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No feed items yet.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((f) => {
                const low = Number(f.low_stock_threshold) > 0 && Number(f.stock_qty) <= Number(f.low_stock_threshold);
                const perContainer = stock.filter((s) => s.feed_item_id === f.id && s.stock_lbs > 0);
                return (
                  <Card key={f.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{f.store ?? "—"}{f.species_for ? ` · for ${f.species_for}` : ""}</div>
                      </div>
                      {low && <Badge variant="outline" className="border-warning text-warning">low</Badge>}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-display font-semibold">{Number(f.stock_qty).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">{f.unit}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{fmt(f.price_cents)} per {f.unit}</div>
                    {perContainer.length > 0 && (
                      <ul className="text-xs space-y-0.5 rounded-md bg-muted/40 p-2">
                        {perContainer.map((s) => (
                          <li key={s.container_id} className="flex justify-between">
                            <span>{containers.find((c) => c.id === s.container_id)?.name ?? "—"}</span>
                            <span>{Number(s.stock_lbs).toFixed(1)} lb</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-1 mt-auto pt-2">
                      <Button size="sm" variant="outline" onClick={() => setPurchaseFor(f)} disabled={containers.length === 0}>
                        <ShoppingCart className="h-3 w-3" /> Buy
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditItem(f)}><Pencil className="h-3 w-3" /></Button>
                      <ConfirmDelete trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                        title={`Delete ${f.name}?`} onConfirm={() => del.mutate(f.id)} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {purchases.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold mb-3">Recent purchases</h2>
              <Card>
                <ul className="divide-y">
                  {purchases.map((p) => {
                    const item = items.find((i) => i.id === p.feed_item_id);
                    const container = containers.find((c) => c.id === p.container_id);
                    return (
                      <li key={p.id} className="px-4 py-3 flex items-center justify-between text-sm flex-wrap gap-2">
                        <div>
                          <div className="font-medium">{item?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(p.purchased_on), "MMM d, yyyy")} · {p.store ?? "—"}
                            {container ? ` · → ${container.name}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>{fmt(p.price_cents)}</div>
                          <div className="text-xs text-muted-foreground">{Number(p.total_lbs ?? p.quantity ?? 0).toFixed(1)} lb</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="containers"><ContainersTab /></TabsContent>
        <TabsContent value="units"><UnitsTab /></TabsContent>
        <TabsContent value="reports"><FeedReportsTab /></TabsContent>
      </Tabs>

      {editItem && (
        <Dialog open onOpenChange={(o) => !o && setEditItem(null)}>
          <FeedItemForm initial={editItem} onSubmit={(p) => save.mutate({ ...p, id: editItem.id })} submitting={save.isPending} />
        </Dialog>
      )}
      {purchaseFor && (
        <Dialog open onOpenChange={(o) => !o && setPurchaseFor(null)}>
          <PurchaseDialog item={purchaseFor} containers={containers} units={units} onSubmit={(p) => addPurchase.mutate(p)} submitting={addPurchase.isPending} />
        </Dialog>
      )}
      {feedingOpen && (
        <Dialog open onOpenChange={setFeedingOpen}>
          <FeedingDialog items={items} containers={containers} units={units} stock={stock} animals={animals} onSubmit={(p) => addFeeding.mutate(p)} submitting={addFeeding.isPending} />
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
          <div><Label>Store</Label><Input value={f.store ?? ""} onChange={(e) => setF({ ...f, store: e.target.value })} maxLength={100} /></div>
          <div><Label>Used for (species)</Label><Input value={f.species_for ?? ""} onChange={(e) => setF({ ...f, species_for: e.target.value })} maxLength={100} /></div>
          <div><Label>Reference price ($)</Label><Input type="number" step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} /></div>
          <div><Label>Unit</Label><Input value={f.unit ?? "lb"} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={20} /></div>
          <div><Label>Default bag size</Label><Input type="number" step="0.1" value={f.package_size ?? ""} onChange={(e) => setF({ ...f, package_size: e.target.value ? Number(e.target.value) : null })} placeholder="50" /></div>
          <div><Label>Low stock alert at</Label><Input type="number" step="0.1" value={f.low_stock_threshold ?? 0} onChange={(e) => setF({ ...f, low_stock_threshold: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
