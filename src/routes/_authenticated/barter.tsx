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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Handshake, Trash2, Pencil, Check, X, ImagePlus, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/barter")({ component: BarterPage });

type Status = "pending" | "completed" | "cancelled";
type Category = "livestock" | "feed" | "equipment" | "labor" | "produce" | "building_materials" | "services" | "other";

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

  const save = useMutation({
    mutationFn: async (p: Partial<Deal> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("barter_deals").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barter_deals").insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barter-deals"] }); toast.success("Saved"); setEdit(null); setNewOpen(false); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barter-deals"] }); toast.success("Deleted"); },
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
          <DealForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
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
          {filtered.map((d) => (
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
                {d.given_summary && <div><span className="text-muted-foreground">Gave:</span> {d.given_summary}</div>}
                {d.received_summary && <div><span className="text-muted-foreground">Got:</span> {d.received_summary}</div>}
              </div>
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
          ))}
        </div>
      )}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DealForm initial={edit} onSubmit={(p) => save.mutate({ ...p, id: edit.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function DealForm({ initial, onSubmit, submitting }: { initial?: Deal; onSubmit: (p: Partial<Deal>) => void; submitting: boolean }) {
  const [f, setF] = useState<Partial<Deal>>(initial ?? {
    title: "", person_name: "", contact_info: "", given_summary: "", received_summary: "",
    status: "pending", category: "other", tags: [], photo_urls: [], estimated_value_cents: 0,
    trade_date: new Date().toISOString().slice(0, 10),
  });
  const [valueDollars, setValueDollars] = useState(initial ? ((initial.estimated_value_cents ?? 0) / 100).toFixed(2) : "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("barter-photos").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("barter-photos").getPublicUrl(path);
      setF((cur) => ({ ...cur, photo_urls: [...(cur.photo_urls ?? []), data.publicUrl] }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit trade" : "New trade"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.title) { toast.error("Title required"); return; }
          onSubmit({
            ...f,
            estimated_value_cents: Math.round(Number(valueDollars || 0) * 100),
            tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
          });
        }}
        className="space-y-3"
      >
        <div><Label>Title *</Label><Input value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Person</Label><Input value={f.person_name ?? ""} onChange={(e) => setF({ ...f, person_name: e.target.value })} maxLength={100} /></div>
          <div><Label>Contact</Label><Input value={f.contact_info ?? ""} onChange={(e) => setF({ ...f, contact_info: e.target.value })} placeholder="Phone or email" maxLength={150} /></div>
        </div>
        <div><Label>Given (what you traded away)</Label><Textarea value={f.given_summary ?? ""} onChange={(e) => setF({ ...f, given_summary: e.target.value })} maxLength={500} /></div>
        <div><Label>Received (what you got)</Label><Textarea value={f.received_summary ?? ""} onChange={(e) => setF({ ...f, received_summary: e.target.value })} maxLength={500} /></div>
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
