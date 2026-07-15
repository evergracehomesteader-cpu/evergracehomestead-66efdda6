import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Copy, Link2, Link2Off, Search, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  SUGGESTION_CATEGORIES, SUGGESTION_STATUSES, statusMeta,
  categoryLabel, priorityLabel, statusVariant,
  type SuggestionStatus,
} from "@/lib/suggestions";

export const Route = createFileRoute("/_authenticated/admin/suggestions")({ component: AdminSuggestionsPage });

type Row = {
  id: string;
  user_id: string;
  homestead_id: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  is_public: boolean;
  admin_notes: string | null;
  admin_reply: string | null;
  duplicate_of: string | null;
  created_at: string;
  profiles?: { display_name: string | null } | null;
  homesteads?: { name: string | null } | null;
};

function AdminSuggestionsPage() {
  const { isAppAdmin, loading } = useIsAppAdmin();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-suggestions"],
    enabled: isAppAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*, profiles:user_id(display_name), homesteads:homestead_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAppAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">App admins only</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate({ to: "/suggestions" })}>Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold flex items-center gap-2">
          <ShieldAlert className="h-7 w-7" /> Suggestions Admin
        </h1>
        <p className="text-muted-foreground">All suggestions submitted across every homestead.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SUGGESTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {SUGGESTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {!isLoading && !filtered.length && (
        <Card className="p-8 text-center text-muted-foreground">No suggestions match.</Card>
      )}

      <div className="grid gap-3">
        {filtered.map((r) => <AdminSuggestionCard key={r.id} row={r} />)}
      </div>
    </div>
  );
}

function AdminSuggestionCard({ row }: { row: Row }) {
  const qc = useQueryClient();
  const meta = statusMeta(row.status);
  const [open, setOpen] = useState(false);

  const quickStatus = useMutation({
    mutationFn: async (status: SuggestionStatus) => {
      const { error } = await supabase.from("suggestions").update({ status }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-suggestions"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{row.title}</div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(row.created_at), "MMM d, yyyy")} · {categoryLabel(row.category)} · {priorityLabel(row.priority)}
            {row.is_public && " · Public"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            From <span className="font-medium">{row.profiles?.display_name ?? "Unknown"}</span>
            {row.homesteads?.name && <> at <span className="font-medium">{row.homesteads.name}</span></>}
          </div>
        </div>
        <Badge variant={statusVariant(row.status)}>{meta.label}</Badge>
      </div>

      {row.description && <p className="text-sm whitespace-pre-wrap">{row.description}</p>}

      <Progress value={meta.progress} />

      {row.admin_reply && (
        <div className="rounded-md border bg-muted/40 p-2 text-sm">
          <div className="text-xs font-medium text-muted-foreground mb-1">Reply</div>
          <p className="whitespace-pre-wrap">{row.admin_reply}</p>
        </div>
      )}
      {row.admin_notes && (
        <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          <span className="font-medium">Internal notes:</span> {row.admin_notes}
        </div>
      )}
      {row.duplicate_of && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Copy className="h-3 w-3" /> Marked duplicate of {row.duplicate_of.slice(0, 8)}…
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Select value={row.status} onValueChange={(v) => quickStatus.mutate(v as SuggestionStatus)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUGGESTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">Edit reply & notes</Button>
          </DialogTrigger>
          <EditDialog row={row} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-suggestions"] }); }} />
        </Dialog>
      </div>
    </Card>
  );
}

type Candidate = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

function tokenize(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
}

function EditDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const [reply, setReply] = useState(row.admin_reply ?? "");
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [dup, setDup] = useState(row.duplicate_of ?? "");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Candidate | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["dup-candidates", row.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("id, title, description, category, status, created_at, profiles:user_id(display_name)")
        .neq("id", row.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Candidate[];
    },
  });

  const currentLink = useMemo(
    () => (candidates ?? []).find((c) => c.id === (dup || row.duplicate_of || "")) ?? null,
    [candidates, dup, row.duplicate_of]
  );

  const likely = useMemo(() => {
    const rowTokens = new Set(tokenize(`${row.title} ${row.description}`));
    if (!rowTokens.size) return [];
    const q = search.trim().toLowerCase();
    const scored = (candidates ?? [])
      .map((c) => {
        const toks = tokenize(`${c.title} ${c.description ?? ""}`);
        let score = 0;
        for (const t of toks) if (rowTokens.has(t)) score++;
        return { c, score };
      })
      .filter(({ c, score }) => {
        if (q) return c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
        return score >= 2;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.c);
    return scored;
  }, [candidates, row.title, row.description, search]);

  const changingDup = (dup || null) !== (row.duplicate_of || null);

  const persist = async () => {
    setSaving(true);
    const { error } = await supabase.from("suggestions").update({
      admin_reply: reply.trim() || null,
      admin_notes: notes.trim() || null,
      duplicate_of: dup.trim() || null,
    }).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setConfirmOpen(false);
    onDone();
  };

  const onSaveClick = () => {
    if (changingDup && dup.trim()) { setConfirmOpen(true); return; }
    persist();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Admin response</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Reply to user (visible to submitter)</Label>
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
        </div>
        <div>
          <Label>Internal notes (admins only)</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1"><Link2 className="h-4 w-4" /> Link as duplicate of</Label>
            {dup && (
              <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => { setDup(""); setPreview(null); }}>
                <Link2Off className="h-3 w-3" /> Unlink
              </Button>
            )}
          </div>

          {currentLink ? (
            <div className="rounded-md border bg-muted/40 p-2 text-sm">
              <div className="text-xs text-muted-foreground">Currently linked to</div>
              <div className="font-medium truncate">{currentLink.title}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(currentLink.created_at), "MMM d, yyyy")} · {categoryLabel(currentLink.category)} · by {currentLink.profiles?.display_name ?? "Unknown"}
              </div>
            </div>
          ) : dup ? (
            <div className="text-xs text-muted-foreground">ID: {dup}</div>
          ) : (
            <div className="text-xs text-muted-foreground">Not linked to any other suggestion.</div>
          )}

          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-sm"
              placeholder="Search suggestions by title or paste an ID…"
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                if (/^[0-9a-f-]{36}$/i.test(v.trim())) setDup(v.trim());
              }}
            />
          </div>

          {likely.length > 0 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground">
                {search ? "Search results" : "Likely duplicates"}
              </div>
              {likely.map((c) => {
                const selected = c.id === dup;
                return (
                  <div
                    key={c.id}
                    className={`rounded-md border p-2 text-sm cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    onClick={() => { setDup(c.id); setPreview(c); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), "MMM d, yyyy")} · {categoryLabel(c.category)} · {statusMeta(c.status).label}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); setPreview(c); }}
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {preview && (
            <div className="rounded-md border-2 border-dashed p-3 space-y-2 bg-muted/20">
              <div className="text-xs font-medium text-muted-foreground">Side-by-side preview</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-medium text-muted-foreground mb-1">This suggestion</div>
                  <div className="font-semibold">{row.title}</div>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-6">{row.description}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Candidate</div>
                  <div className="font-semibold">{preview.title}</div>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-6">{preview.description}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSaveClick} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Confirm duplicate link
            </AlertDialogTitle>
            <AlertDialogDescription>
              You're about to mark this suggestion as a duplicate. Review both entries below to make sure they really match.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 text-xs border rounded-md p-3">
            <div>
              <div className="font-medium text-muted-foreground mb-1">This suggestion</div>
              <div className="font-semibold">{row.title}</div>
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-8">{row.description}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground mb-1">Duplicate of</div>
              <div className="font-semibold">{(currentLink ?? preview)?.title ?? dup}</div>
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-8">
                {(currentLink ?? preview)?.description ?? ""}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={persist} disabled={saving}>
              {saving ? "Saving…" : "Confirm & save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );
}

