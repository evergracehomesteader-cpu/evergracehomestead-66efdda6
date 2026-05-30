import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Handshake, Trash2, Pencil, Check, X, ImagePlus, MapPin, Link2, PawPrint, Wheat, Sprout, Wrench, Briefcase, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/photo-storage";
import { SignedImg } from "@/components/SignedImg";

export const Route = createFileRoute("/_authenticated/barter")({ component: BarterPage });

type Status = "pending" | "completed" | "cancelled";
type Category = "livestock" | "feed" | "equipment" | "labor" | "produce" | "building_materials" | "services" | "other";
type Direction = "given" | "received";
type LinkType = "animal" | "feed" | "garden" | "equipment" | "service" | "other";

type Deal = {
  id: string;
  title: string;
  contact_id: string | null;
  person_name: string | null;
  contact_info: string | null;
  given_summary: string | null;
  received_summary: string | null;
  estimated_value_cents: number;
  trade_date: string | null;
  due_date: string | null;
  status: Status;
  category: Category;
  location: string | null;
  tags: string[];
  photo_urls: string[];
  notes: string | null;
};

type Item = {
  id?: string;
  deal_id?: string;
  direction: Direction;
  link_type: LinkType;
  link_id: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  value_cents: number | null;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "livestock", label: "Livestock" },
  { value: "feed", label: "Feed" },
  { value: "equipment", label: "Equipment" },
  { value: "labor", label: "Labor" },
  { value: "produce", label: "Produce" },
  { value: "building_materials", label: "Building materials" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const LINK_TYPES: { value: LinkType; label: string; icon: typeof PawPrint }[] = [
  { value: "animal", label: "Animal", icon: PawPrint },
  { value: "feed", label: "Feed item", icon: Wheat },
  { value: "garden", label: "Crop / plot", icon: Sprout },
  { value: "equipment", label: "Equipment", icon: Wrench },
  { value: "service", label: "Service", icon: Briefcase },
  { value: "other", label: "Other", icon: Package },
];

const fmt = (cents: number | null) => cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "completed" ? "bg-success text-success-foreground border-transparent"
      : status === "cancelled" ? "bg-destructive text-destructive-foreground border-transparent"
      : "bg-warning text-warning-foreground border-transparent";
  return <Badge className={cls}>{status}</Badge>;
}

function BarterPage() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Deal | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [personFilter, setPersonFilter] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");

  const { data: deals } = useQuery({
    queryKey: ["barter-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barter_deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
  });

  const { data: allItems } = useQuery({
    queryKey: ["barter-items-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barter_items").select("*");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const itemsByDeal = useMemo(() => {
    const m = new Map<string, Item[]>();
    (allItems ?? []).forEach((it) => {
      if (!it.deal_id) return;
      const arr = m.get(it.deal_id) ?? [];
      arr.push(it);
      m.set(it.deal_id, arr);
    });
    return m;
  }, [allItems]);

  const save = useMutation({
    mutationFn: async ({ deal, items }: { deal: Partial<Deal> & { id?: string }; items: Item[] }) => {
      const { data: u } = await supabase.auth.getUser();
      let dealId = deal.id;
      if (deal.id) {
        const { id, ...rest } = deal;
        const { error } = await supabase.from("barter_deals").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("barter_deals").insert({ ...deal, created_by: u.user?.id } as never).select("id").single();
        if (error) throw error;
        dealId = (data as { id: string }).id;
      }
      // sync items: replace all
      await supabase.from("barter_items").delete().eq("deal_id", dealId!);
      if (items.length > 0) {
        const rows = items.map((it) => ({
          deal_id: dealId!,
          direction: it.direction,
          link_type: it.link_type,
          link_id: it.link_id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          value_cents: it.value_cents,
        }));
        const { error } = await supabase.from("barter_items").insert(rows as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["barter-deals"] });
      qc.invalidateQueries({ queryKey: ["barter-items-all"] });
      toast.success("Saved");
      setEdit(null);
      setNewOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("barter_deals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barter-deals"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("barter_deals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barter-deals"] }); qc.invalidateQueries({ queryKey: ["barter-items-all"] }); toast.success("Deleted"); },
  });

  const filtered = useMemo(() => {
    return (deals ?? []).filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (catFilter !== "all" && d.category !== catFilter) return false;
      if (personFilter && !(d.person_name ?? "").toLowerCase().includes(personFilter.toLowerCase())) return false;
      return true;
    });
  }, [deals, filter, catFilter, personFilter]);

  const counts = useMemo(() => {
    const all = deals ?? [];
    return {
      pending: all.filter((d) => d.status === "pending").length,
      completed: all.filter((d) => d.status === "completed").length,
      cancelled: all.filter((d) => d.status === "cancelled").length,
    };
  }, [deals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Barter</h1>
          <p className="text-muted-foreground">Track trades and exchanges with your community.</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New trade</Button></DialogTrigger>
          <DealForm onSubmit={(deal, items) => save.mutate({ deal, items })} submitting={save.isPending} />
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-display font-semibold text-warning">{counts.pending}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-display font-semibold text-success">{counts.completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Cancelled</div><div className="text-2xl font-display font-semibold text-muted-foreground">{counts.cancelled}</div></Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs">Status</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs">Category</Label>
            <Select value={catFilter} onValueChange={(v) => setCatFilter(v as typeof catFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Person</Label>
            <Input value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} placeholder="Search by name" />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Handshake className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No trades match. Add a new trade to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const items = itemsByDeal.get(d.id) ?? [];
            const given = items.filter((i) => i.direction === "given");
            const received = items.filter((i) => i.direction === "received");
            return (
              <Card key={d.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.person_name ?? "—"} · {CATEGORIES.find((c) => c.value === d.category)?.label}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                {d.photo_urls.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto">
                    {d.photo_urls.slice(0, 3).map((u) => (
                      <img key={u} src={u} alt="" className="h-16 w-16 object-cover rounded-md flex-shrink-0" />
                    ))}
                  </div>
                )}
                <div className="text-sm space-y-1">
                  {given.length > 0 ? (
                    <ItemList label="Gave" items={given} />
                  ) : d.given_summary ? (
                    <div><span className="text-muted-foreground">Gave:</span> {d.given_summary}</div>
                  ) : null}
                  {received.length > 0 ? (
                    <ItemList label="Got" items={received} />
                  ) : d.received_summary ? (
                    <div><span className="text-muted-foreground">Got:</span> {d.received_summary}</div>
                  ) : null}
                </div>
                <ValueComparison given={given} received={received} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmt(d.estimated_value_cents)}</span>
                  {d.due_date && d.status === "pending" && <span>due {format(new Date(d.due_date), "MMM d")}</span>}
                  {d.trade_date && d.status !== "pending" && <span>{format(new Date(d.trade_date), "MMM d, yyyy")}</span>}
                </div>
                {d.location && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.location}</div>}
                {d.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {d.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                )}
                <div className="flex gap-1 mt-auto pt-2 flex-wrap">
                  {d.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: d.id, status: "completed" })}><Check className="h-3 w-3" /> Complete</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: d.id, status: "cancelled" })}><X className="h-3 w-3" /> Cancel</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEdit(d)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${d.title}"?`)) del.mutate(d.id); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DealForm
            initial={edit}
            initialItems={itemsByDeal.get(edit.id) ?? []}
            onSubmit={(deal, items) => save.mutate({ deal: { ...deal, id: edit.id }, items })}
            submitting={save.isPending}
          />
        </Dialog>
      )}
    </div>
  );
}

function ValueComparison({ given, received }: { given: Item[]; received: Item[] }) {
  const g = given.reduce((s, i) => s + Number(i.value_cents ?? 0), 0);
  const r = received.reduce((s, i) => s + Number(i.value_cents ?? 0), 0);
  if (g === 0 && r === 0) return null;
  const diff = r - g;
  const cls = diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-warning";
  const sign = diff > 0 ? "+" : "";
  return (
    <div className="text-xs flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
      <span className="text-muted-foreground">Gave {fmt(g)} · Got {fmt(r)}</span>
      <span className={`font-medium ${cls}`}>{sign}{fmt(diff)}</span>
    </div>
  );
}

function ItemList({ label, items }: { label: string; items: Item[] }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>
      <ul className="ml-2 space-y-0.5">
        {items.map((it, i) => {
          const meta = LINK_TYPES.find((l) => l.value === it.link_type);
          const Icon = meta?.icon ?? Package;
          const qty = it.quantity != null ? `${it.quantity}${it.unit ? ` ${it.unit}` : ""} · ` : "";
          return (
            <li key={it.id ?? i} className="flex items-center gap-1 text-sm">
              <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{qty}{it.description}</span>
              {it.link_id && <Link2 className="h-3 w-3 text-primary flex-shrink-0" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DealForm({
  initial,
  initialItems,
  onSubmit,
  submitting,
}: {
  initial?: Deal;
  initialItems?: Item[];
  onSubmit: (deal: Partial<Deal>, items: Item[]) => void;
  submitting: boolean;
}) {
  const [f, setF] = useState<Partial<Deal>>(initial ?? {
    title: "", person_name: "", contact_info: "", given_summary: "", received_summary: "",
    status: "pending", category: "other", tags: [], photo_urls: [], estimated_value_cents: 0,
    trade_date: new Date().toISOString().slice(0, 10),
  });
  const [items, setItems] = useState<Item[]>(initialItems ?? []);
  const [valueDollars, setValueDollars] = useState(initial ? ((initial.estimated_value_cents ?? 0) / 100).toFixed(2) : "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [uploading, setUploading] = useState(false);

  // Re-initialize when editing a different deal
  useEffect(() => {
    if (initialItems) setItems(initialItems);
  }, [initialItems]);

  const handleUpload = async (file: File) => {
    const invalid = validateImageFile(file);
    if (invalid) { toast.error(invalid); return; }
    setUploading(true);
    try {
      const ext = (file.type.split("/")[1] ?? "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("barter-photos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setF((cur) => ({ ...cur, photo_urls: [...(cur.photo_urls ?? []), path] }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addItem = (direction: Direction) => {
    setItems((cur) => [...cur, { direction, link_type: "other", link_id: null, description: "", quantity: null, unit: null, value_cents: null }]);
  };
  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((cur) => cur.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx: number) => setItems((cur) => cur.filter((_, i) => i !== idx));

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? "Edit trade" : "New trade"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.title) { toast.error("Title required"); return; }
          for (const it of items) {
            if (!it.description.trim()) { toast.error("Each item needs a description"); return; }
          }
          onSubmit(
            {
              ...f,
              estimated_value_cents: Math.round(Number(valueDollars || 0) * 100),
              tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
            },
            items,
          );
        }}
        className="space-y-3"
      >
        <div><Label>Title *</Label><Input value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Person</Label><Input value={f.person_name ?? ""} onChange={(e) => setF({ ...f, person_name: e.target.value })} maxLength={100} /></div>
          <div><Label>Contact</Label><Input value={f.contact_info ?? ""} onChange={(e) => setF({ ...f, contact_info: e.target.value })} placeholder="Phone or email" maxLength={150} /></div>
        </div>

        <ItemsEditor
          title="Items given"
          direction="given"
          items={items.filter((i) => i.direction === "given")}
          getIndex={(it) => items.indexOf(it)}
          onAdd={() => addItem("given")}
          onUpdate={updateItem}
          onRemove={removeItem}
        />
        <ItemsEditor
          title="Items received"
          direction="received"
          items={items.filter((i) => i.direction === "received")}
          getIndex={(it) => items.indexOf(it)}
          onAdd={() => addItem("received")}
          onUpdate={updateItem}
          onRemove={removeItem}
        />

        <div><Label>Given summary (free text, optional)</Label><Textarea value={f.given_summary ?? ""} onChange={(e) => setF({ ...f, given_summary: e.target.value })} maxLength={500} rows={2} /></div>
        <div><Label>Received summary (free text, optional)</Label><Textarea value={f.received_summary ?? ""} onChange={(e) => setF({ ...f, received_summary: e.target.value })} maxLength={500} rows={2} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as Category })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Estimated value ($)</Label><Input type="number" step="0.01" value={valueDollars} onChange={(e) => setValueDollars(e.target.value)} /></div>
          <div><Label>Location</Label><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={150} /></div>
          <div><Label>Trade date</Label><Input type="date" value={f.trade_date ?? ""} onChange={(e) => setF({ ...f, trade_date: e.target.value || null })} /></div>
          <div><Label>Due date</Label><Input type="date" value={f.due_date ?? ""} onChange={(e) => setF({ ...f, due_date: e.target.value || null })} /></div>
        </div>
        <div><Label>Tags (comma separated)</Label><Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="hay, fall, neighbor" /></div>
        <div>
          <Label>Photos</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {(f.photo_urls ?? []).map((u) => (
              <div key={u} className="relative">
                <img src={u} alt="" className="h-16 w-16 object-cover rounded-md" />
                <button type="button" onClick={() => setF({ ...f, photo_urls: (f.photo_urls ?? []).filter((p) => p !== u) })} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">×</button>
              </div>
            ))}
            <label className="h-16 w-16 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:bg-accent">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = ""; }} />
            </label>
          </div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting || uploading}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function ItemsEditor({
  title,
  direction,
  items,
  getIndex,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  direction: Direction;
  items: Item[];
  getIndex: (it: Item) => number;
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<Item>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <Card className="p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{title}</div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="h-3 w-3" /> Add item</Button>
      </div>
      {items.length === 0 && <div className="text-xs text-muted-foreground">No linked items. Use the summary field below for free-form notes.</div>}
      {items.map((it) => {
        const idx = getIndex(it);
        return <ItemRow key={idx} item={it} onUpdate={(p) => onUpdate(idx, p)} onRemove={() => onRemove(idx)} />;
      })}
      <input type="hidden" value={direction} readOnly />
    </Card>
  );
}

function ItemRow({ item, onUpdate, onRemove }: { item: Item; onUpdate: (p: Partial<Item>) => void; onRemove: () => void }) {
  const needsPicker = item.link_type === "animal" || item.link_type === "feed" || item.link_type === "garden";

  const { data: animals } = useQuery({
    queryKey: ["animals-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("id, name, tag, species").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: needsPicker,
  });
  const { data: feeds } = useQuery({
    queryKey: ["feeds-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_items").select("id, name, unit").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: needsPicker,
  });
  const { data: plots } = useQuery({
    queryKey: ["plots-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garden_plots").select("id, name, crop").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: needsPicker,
  });

  const pickerOptions =
    item.link_type === "animal" ? (animals ?? []).map((a) => ({ id: a.id, label: `${a.name}${a.tag ? ` (#${a.tag})` : ""} — ${a.species}` }))
      : item.link_type === "feed" ? (feeds ?? []).map((x) => ({ id: x.id, label: x.name }))
      : item.link_type === "garden" ? (plots ?? []).map((p) => ({ id: p.id, label: `${p.name}${p.crop ? ` — ${p.crop}` : ""}` }))
      : [];

  return (
    <div className="space-y-2 p-2 rounded-md border bg-background">
      <div className="flex gap-2">
        <Select
          value={item.link_type}
          onValueChange={(v) => onUpdate({ link_type: v as LinkType, link_id: null })}
        >
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((lt) => (
              <SelectItem key={lt.value} value={lt.value}>
                <div className="flex items-center gap-2"><lt.icon className="h-3 w-3" /> {lt.label}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {needsPicker && (
        <Select value={item.link_id ?? "__none"} onValueChange={(v) => {
          const id = v === "__none" ? null : v;
          const opt = pickerOptions.find((o) => o.id === v);
          onUpdate({ link_id: id, description: opt && !item.description ? opt.label : item.description });
        }}>
          <SelectTrigger><SelectValue placeholder={`Pick ${item.link_type}…`} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— None (no link) —</SelectItem>
            {pickerOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Input
        placeholder={item.link_type === "service" ? "e.g. Tractor work, fence repair" : item.link_type === "equipment" ? "e.g. Wheelbarrow" : "Description"}
        value={item.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        maxLength={200}
      />
      <div className="grid grid-cols-3 gap-2">
        <Input type="number" step="0.01" placeholder="Qty" value={item.quantity ?? ""} onChange={(e) => onUpdate({ quantity: e.target.value === "" ? null : Number(e.target.value) })} />
        <Input placeholder="Unit" value={item.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value || null })} maxLength={20} />
        <Input type="number" step="0.01" placeholder="Value $" value={item.value_cents == null ? "" : (item.value_cents / 100).toFixed(2)} onChange={(e) => onUpdate({ value_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} />
      </div>
    </div>
  );
}
