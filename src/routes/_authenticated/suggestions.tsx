import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useHomestead } from "@/lib/homestead-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Lightbulb, Plus, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  SUGGESTION_CATEGORIES, SUGGESTION_PRIORITIES, statusMeta,
  categoryLabel, priorityLabel, statusVariant,
  type SuggestionCategory, type SuggestionPriority,
} from "@/lib/suggestions";

export const Route = createFileRoute("/_authenticated/suggestions")({ component: SuggestionsPage });

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
  admin_reply: string | null;
  created_at: string;
};

function SuggestionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [open, setOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["suggestions", tab, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("suggestions").select("*").order("created_at", { ascending: false });
      if (tab === "mine") q = q.eq("user_id", user!.id);
      else q = q.eq("is_public", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suggestions"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold flex items-center gap-2">
            <Lightbulb className="h-7 w-7" /> Suggestions
          </h1>
          <p className="text-muted-foreground">Share ideas, report bugs, or ask questions about the app.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New suggestion</Button>
          </DialogTrigger>
          <NewSuggestionDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["suggestions"] }); }} />
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "mine" ? "default" : "outline"} onClick={() => setTab("mine")}>My suggestions</Button>
        <Button size="sm" variant={tab === "public" ? "default" : "outline"} onClick={() => setTab("public")}>Public</Button>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {!isLoading && !rows?.length && (
        <Card className="p-8 text-center text-muted-foreground">
          {tab === "mine" ? "You haven't submitted any suggestions yet." : "No public suggestions yet."}
        </Card>
      )}

      <div className="grid gap-3">
        {rows?.map((r) => (
          <SuggestionCard
            key={r.id}
            row={r}
            canDelete={r.user_id === user?.id && r.status === "submitted"}
            onDelete={() => del.mutate(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ row, canDelete, onDelete }: { row: Row; canDelete: boolean; onDelete: () => void }) {
  const meta = statusMeta(row.status);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{row.title}</div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(row.created_at), "MMM d, yyyy")} · {categoryLabel(row.category)} · {priorityLabel(row.priority)}
            {row.is_public && " · Public"}
          </div>
        </div>
        <Badge variant={statusVariant(row.status)}>{meta.label}</Badge>
      </div>
      {row.description && <p className="text-sm whitespace-pre-wrap">{row.description}</p>}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span><span>{meta.progress}%</span>
        </div>
        <Progress value={meta.progress} />
      </div>
      {row.admin_reply && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <MessageSquare className="h-3 w-3" /> Reply from the team
          </div>
          <p className="whitespace-pre-wrap">{row.admin_reply}</p>
        </div>
      )}
      {canDelete && (
        <div className="flex justify-end">
          <ConfirmDelete onConfirm={onDelete} title="Delete this suggestion?">
            <Button size="sm" variant="ghost" className="text-destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </ConfirmDelete>
        </div>
      )}
    </Card>
  );
}

function NewSuggestionDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { currentId } = useHomestead();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestionCategory>("feature");
  const [priority, setPriority] = useState<SuggestionPriority>("medium");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("suggestions").insert({
      user_id: user.id,
      homestead_id: currentId && currentId !== "demo" ? currentId : null,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Suggestion submitted");
    setTitle(""); setDescription(""); setCategory("feature"); setPriority("medium"); setIsPublic(false);
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New suggestion</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" maxLength={140} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="What would you like to see, or what went wrong?" maxLength={4000} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SuggestionCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUGGESTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as SuggestionPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUGGESTION_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Make public</div>
            <div className="text-xs text-muted-foreground">Let other homesteads see this suggestion.</div>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
