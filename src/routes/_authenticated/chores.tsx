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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ListChecks, Trash2, Pencil, CheckCircle2, Users } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { isDueOnDate, describeRecurrence, todayISO, DAY_NAMES, CHORE_CATEGORIES, type ChoreRow, type ChoreAssignment, type ChoreCompletion, type Recurrence } from "@/lib/chores";

export const Route = createFileRoute("/_authenticated/chores")({ component: ChoresPage });

type ProfileLite = { id: string; display_name: string | null; active: boolean };

function ChoresPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can, hasRole } = usePermissions();
  const canManage = can("chores.create") || can("chores.edit") || hasRole("admin") || hasRole("manager");
  const canComplete = can("chores.complete") || hasRole("admin") || hasRole("manager");
  const [editing, setEditing] = useState<ChoreRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data: chores = [] } = useQuery({
    queryKey: ["chores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chores").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChoreRow[];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["chore_assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chore_assignments").select("*");
      if (error) throw error;
      return (data ?? []) as ChoreAssignment[];
    },
  });
  const { data: completions = [] } = useQuery({
    queryKey: ["chore_completions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chore_completions").select("*").gte("instance_date", format(addDays(new Date(), -14), "yyyy-MM-dd"));
      if (error) throw error;
      return (data ?? []) as ChoreCompletion[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, active");
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const assignByChore = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of assignments) {
      const arr = m.get(a.chore_id) ?? [];
      arr.push(a.user_id);
      m.set(a.chore_id, arr);
    }
    return m;
  }, [assignments]);

  const today = todayISO();
  const completionForToday = useMemo(() => {
    const m = new Map<string, ChoreCompletion>();
    for (const c of completions) if (c.instance_date === today) m.set(c.chore_id, c);
    return m;
  }, [completions, today]);

  const dueToday = useMemo(() => chores.filter((c) => isDueOnDate(c, today)), [chores, today]);
  const upcoming = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i + 1), "yyyy-MM-dd"));
    return days.flatMap((d) => chores.filter((c) => isDueOnDate(c, d)).map((c) => ({ chore: c, date: d })));
  }, [chores]);

  const myAssignedToday = useMemo(() => {
    if (!user) return [] as ChoreRow[];
    return dueToday.filter((c) => (assignByChore.get(c.id) ?? []).includes(user.id));
  }, [dueToday, assignByChore, user]);

  const toggleComplete = useMutation({
    mutationFn: async (chore: ChoreRow) => {
      const existing = completionForToday.get(chore.id);
      if (existing) {
        const { error } = await (supabase as any).from("chore_completions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("chore_completions").insert({
          chore_id: chore.id, instance_date: today, completed_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chore_completions"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: async (p: Partial<ChoreRow> & { id?: string; assignees?: string[] }) => {
      const { assignees, id, ...rest } = p;
      if (id) {
        const { error } = await (supabase as any).from("chores").update(rest).eq("id", id);
        if (error) throw error;
        if (assignees) {
          await (supabase as any).from("chore_assignments").delete().eq("chore_id", id);
          if (assignees.length) {
            await (supabase as any).from("chore_assignments").insert(assignees.map((u) => ({ chore_id: id, user_id: u })));
          }
        }
      } else {
        const { data, error } = await (supabase as any).from("chores").insert({ ...rest, created_by: user?.id }).select("id").single();
        if (error) throw error;
        if (assignees?.length) {
          await (supabase as any).from("chore_assignments").insert(assignees.map((u) => ({ chore_id: data.id, user_id: u })));
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chores"] });
      qc.invalidateQueries({ queryKey: ["chore_assignments"] });
      setOpen(false); setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("chores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chores"] }); toast.success("Deleted"); },
  });

  const renderChoreCard = (chore: ChoreRow, dateLabel?: string) => {
    const assignees = assignByChore.get(chore.id) ?? [];
    const completion = dateLabel ? null : completionForToday.get(chore.id);
    const isAssignedToMe = user ? assignees.includes(user.id) : false;
    const canMarkThis = canComplete && (canManage || isAssignedToMe || assignees.length === 0);
    const completedBy = completion?.completed_by ? profileMap.get(completion.completed_by)?.display_name ?? "Someone" : null;
    return (
      <li key={chore.id + (dateLabel ?? "")} className="px-4 py-3 flex items-start gap-3">
        {!dateLabel && (
          <Checkbox
            checked={!!completion}
            disabled={!canMarkThis || toggleComplete.isPending}
            onCheckedChange={() => toggleComplete.mutate(chore)}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${completion ? "line-through text-muted-foreground" : ""}`}>{chore.title}</div>
          {chore.notes && <div className="text-xs text-muted-foreground mt-0.5">{chore.notes}</div>}
          <div className="flex gap-2 mt-1 flex-wrap items-center">
            <Badge variant="outline" className="text-[10px]">{chore.category}</Badge>
            <Badge variant="outline" className="text-[10px]">{describeRecurrence(chore)}</Badge>
            {dateLabel && <Badge variant="secondary" className="text-[10px]">{dateLabel}</Badge>}
            {assignees.length > 0 && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {assignees.map((u) => profileMap.get(u)?.display_name ?? "Unknown").join(", ")}
              </span>
            )}
            {completion && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                {completedBy} · {format(new Date(completion.completed_at), "h:mm a")}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(chore)}><Pencil className="h-4 w-4" /></Button>
            <ConfirmDelete
              trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
              title={`Delete "${chore.title}"?`}
              onConfirm={() => del.mutate(chore.id)}
            />
          </>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Chores</h1>
          <p className="text-muted-foreground">Daily, weekly, and recurring tasks.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New chore</Button></DialogTrigger>
            <ChoreForm
              profiles={profiles}
              onSubmit={(p) => save.mutate(p)}
              submitting={save.isPending}
            />
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today ({dueToday.length})</TabsTrigger>
          <TabsTrigger value="mine">Mine ({myAssignedToday.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="all">All ({chores.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-3">
          {dueToday.length === 0 ? (
            <Card className="p-12 text-center"><ListChecks className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Nothing due today.</p></Card>
          ) : (
            <Card><ul className="divide-y">{dueToday.map((c) => renderChoreCard(c))}</ul></Card>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-3">
          {myAssignedToday.length === 0 ? (
            <Card className="p-12 text-center"><p className="text-muted-foreground">No chores assigned to you today.</p></Card>
          ) : (
            <Card><ul className="divide-y">{myAssignedToday.map((c) => renderChoreCard(c))}</ul></Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-3">
          {upcoming.length === 0 ? (
            <Card className="p-12 text-center"><p className="text-muted-foreground">Nothing upcoming.</p></Card>
          ) : (
            <Card><ul className="divide-y">{upcoming.map(({ chore, date }) => renderChoreCard(chore, format(new Date(date), "EEE, MMM d")))}</ul></Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-3">
          {chores.length === 0 ? (
            <Card className="p-12 text-center"><p className="text-muted-foreground">No chores yet.</p></Card>
          ) : (
            <Card><ul className="divide-y">{chores.map((c) => renderChoreCard(c))}</ul></Card>
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <ChoreForm
            initial={editing}
            initialAssignees={assignByChore.get(editing.id) ?? []}
            profiles={profiles}
            onSubmit={(p) => save.mutate({ ...p, id: editing.id })}
            submitting={save.isPending}
          />
        </Dialog>
      )}
    </div>
  );
}

function ChoreForm({ initial, initialAssignees = [], profiles, onSubmit, submitting }: {
  initial?: ChoreRow; initialAssignees?: string[]; profiles: ProfileLite[];
  onSubmit: (p: Partial<ChoreRow> & { assignees?: string[] }) => void; submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? "daily");
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? []);
  const [dayOfMonth, setDayOfMonth] = useState<string>(initial?.day_of_month?.toString() ?? "");
  const [dueTime, setDueTime] = useState(initial?.due_time?.slice(0, 5) ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? format(new Date(), "yyyy-MM-dd"));
  const [active, setActive] = useState(initial?.active ?? true);
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);

  const toggleDay = (d: number) => setDays((arr) => arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d].sort());
  const toggleAssignee = (id: string) => setAssignees((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit chore" : "New chore"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) { toast.error("Title required"); return; }
          onSubmit({
            title: title.trim(),
            notes: notes || null,
            category,
            recurrence,
            days_of_week: recurrence === "weekly" ? days : [],
            day_of_month: recurrence === "monthly" && dayOfMonth ? parseInt(dayOfMonth, 10) : null,
            due_time: dueTime || null,
            start_date: startDate,
            active,
            assignees,
          });
        }}
        className="space-y-3"
      >
        <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHORE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="once">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {recurrence === "weekly" && (
          <div>
            <Label>Days of week</Label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {DAY_NAMES.map((n, i) => (
                <Button key={i} type="button" size="sm" variant={days.includes(i) ? "default" : "outline"} onClick={() => toggleDay(i)}>{n}</Button>
              ))}
            </div>
          </div>
        )}
        {recurrence === "monthly" && (
          <div><Label>Day of month (1-31)</Label><Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} /></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Due time (optional)</Label><Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></div>
          <div><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        </div>
        <div>
          <Label>Assigned to</Label>
          <div className="flex flex-col gap-1 mt-1 max-h-40 overflow-y-auto border rounded p-2">
            {profiles.length === 0 && <p className="text-xs text-muted-foreground">No users yet.</p>}
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                <Checkbox checked={assignees.includes(p.id)} onCheckedChange={() => toggleAssignee(p.id)} />
                {p.display_name ?? "Unnamed"}{!p.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
              </label>
            ))}
          </div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} /> Active</label>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
