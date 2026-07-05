import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Plus, CalendarCheck, Trash2, Pencil, Users as UsersIcon } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/chores")({ component: ChoresPage });

type Chore = {
  id: string; title: string; notes: string | null; category: string;
  recurrence: "daily" | "weekly" | "monthly";
  days_of_week: number[]; day_of_month: number | null;
  due_time: string | null; start_date: string; end_date: string | null;
  active: boolean;
};
type Assignment = { id: string; chore_id: string; user_id: string };
type Completion = { id: string; chore_id: string; instance_date: string; completed_by: string | null; completed_at: string };
type Profile = { id: string; display_name: string | null };

const CATEGORIES = ["general", "animal", "feed", "garden", "compost", "kitchen", "maintenance"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Loose-typed client wrappers (dynamic table names not in generated types).
const db = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      order?: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
      eq?: (c: string, v: unknown) => Promise<{ data: unknown[] | null; error: Error | null }>;
    } & Promise<{ data: unknown[] | null; error: Error | null }>;
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: Error | null }> };
    delete: () => { eq: (c: string, v: unknown) => Promise<{ error: Error | null }> };
  };
};

function ChoresPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can("chores.create") || can("chores.edit");
  const canComplete = can("chores.complete");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Chore | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");
  const dow = new Date().getDay();
  const dom = new Date().getDate();

  const choresQ = useQuery({
    queryKey: ["chores"],
    queryFn: async () => {
      const { data, error } = await db.from("chores").select("*");
      if (error) throw error;
      return (data ?? []) as Chore[];
    },
  });
  const assignQ = useQuery({
    queryKey: ["chore_assignments"],
    queryFn: async () => {
      const { data, error } = await db.from("chore_assignments").select("*");
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });
  const todayCompQ = useQuery({
    queryKey: ["chore_completions", today],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: Error | null }> } } })
        .from("chore_completions").select("*").eq("instance_date", today);
      if (error) throw error;
      return (data ?? []) as Completion[];
    },
  });
  const profilesQ = useQuery({
    queryKey: ["profiles-active"],
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id, display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profilesQ.data ?? []) m.set(p.id, p.display_name ?? "Unknown");
    return m;
  }, [profilesQ.data]);

  const todayChores = useMemo(() => {
    return (choresQ.data ?? []).filter((c) => {
      if (!c.active) return false;
      if (c.start_date > today) return false;
      if (c.end_date && c.end_date < today) return false;
      if (c.recurrence === "daily") return true;
      if (c.recurrence === "weekly") return (c.days_of_week ?? []).includes(dow);
      if (c.recurrence === "monthly") return c.day_of_month === dom;
      return false;
    });
  }, [choresQ.data, today, dow, dom]);

  const assigneesFor = (choreId: string) =>
    (assignQ.data ?? []).filter((a) => a.chore_id === choreId).map((a) => a.user_id);

  const completion = (choreId: string) =>
    (todayCompQ.data ?? []).find((c) => c.chore_id === choreId);

  const complete = useMutation({
    mutationFn: async (chore: Chore) => {
      const existing = completion(chore.id);
      if (existing) {
        const { error } = await db.from("chore_completions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("chore_completions").insert({
          chore_id: chore.id, instance_date: today, completed_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chore_completions", today] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const saveChore = useMutation({
    mutationFn: async (p: { chore: Partial<Chore> & { id?: string }; assignees: string[] }) => {
      let id = p.chore.id;
      if (id) {
        const { id: _id, ...rest } = p.chore;
        const { error } = await db.from("chores").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const insertPayload = { ...p.chore, created_by: user?.id };
        const { data, error } = await (supabase as unknown as { from: (t: string) => { insert: (r: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: Error | null }> } } } })
          .from("chores").insert(insertPayload).select("id").single();
        if (error) throw error;
        id = data!.id;
      }
      // Replace assignments
      await db.from("chore_assignments").delete().eq("chore_id", id!);
      if (p.assignees.length > 0) {
        const { error } = await db.from("chore_assignments")
          .insert(p.assignees.map((uid) => ({ chore_id: id, user_id: uid })));
        if (error) throw error;
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

  const delChore = useMutation({
    mutationFn: async (id: string) => {
      await db.from("chore_assignments").delete().eq("chore_id", id);
      await db.from("chore_completions").delete().eq("chore_id", id);
      const { error } = await db.from("chores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chores"] }); toast.success("Deleted"); },
  });

  const recurrenceLabel = (c: Chore) => {
    if (c.recurrence === "daily") return "Every day";
    if (c.recurrence === "weekly") return `Weekly · ${(c.days_of_week ?? []).map((d) => DAY_LABELS[d]).join(", ") || "—"}`;
    if (c.recurrence === "monthly") return `Monthly · day ${c.day_of_month ?? "?"}`;
    return c.recurrence;
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Chores</h1>
          <p className="text-muted-foreground">Recurring daily, weekly, and monthly homestead chores.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New chore</Button></DialogTrigger>
            <ChoreForm
              initial={editing ?? undefined}
              profiles={profilesQ.data ?? []}
              initialAssignees={editing ? assigneesFor(editing.id) : []}
              submitting={saveChore.isPending}
              onSubmit={(chore, assignees) => saveChore.mutate({ chore: editing ? { ...chore, id: editing.id } : chore, assignees })}
            />
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All chores</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-2 mt-3">
          {todayChores.length === 0 ? (
            <Card className="p-10 text-center">
              <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No chores scheduled for today.</p>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y">
                {todayChores.map((c) => {
                  const comp = completion(c.id);
                  const assignees = assigneesFor(c.id);
                  return (
                    <li key={c.id} className="px-4 py-3 flex items-start gap-3">
                      <Checkbox
                        checked={!!comp}
                        disabled={!canComplete || complete.isPending}
                        onCheckedChange={() => complete.mutate(c)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${comp ? "line-through text-muted-foreground" : ""}`}>{c.title}</div>
                        {c.notes && <div className="text-xs text-muted-foreground mt-0.5">{c.notes}</div>}
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                          {c.due_time && <Badge variant="outline" className="text-[10px]">{c.due_time.slice(0, 5)}</Badge>}
                          {assignees.length === 0
                            ? <Badge variant="outline" className="text-[10px]">Unassigned</Badge>
                            : assignees.map((uid) => (
                                <Badge key={uid} variant="secondary" className="text-[10px]">
                                  {profileMap.get(uid) ?? "user"}
                                </Badge>
                              ))}
                          {comp && <Badge className="text-[10px]">Done</Badge>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-2 mt-3">
          {(choresQ.data ?? []).length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No chores yet.</Card>
          ) : (
            <Card>
              <ul className="divide-y">
                {(choresQ.data ?? []).map((c) => {
                  const assignees = assigneesFor(c.id);
                  return (
                    <li key={c.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {c.title}
                          {!c.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{recurrenceLabel(c)}</div>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                          <Badge variant="outline" className="text-[10px]"><UsersIcon className="h-3 w-3 mr-0.5" />
                            {assignees.length === 0 ? "Unassigned" : `${assignees.length} assigned`}
                          </Badge>
                        </div>
                      </div>
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(c); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmDelete
                            trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
                            title={`Delete "${c.title}"?`}
                            onConfirm={() => delChore.mutate(c.id)}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChoreForm({
  initial, profiles, initialAssignees, submitting, onSubmit,
}: {
  initial?: Chore; profiles: Profile[]; initialAssignees: string[]; submitting: boolean;
  onSubmit: (chore: Partial<Chore>, assignees: string[]) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "monthly">(initial?.recurrence ?? "daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial?.days_of_week ?? []);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initial?.day_of_month ?? 1);
  const [dueTime, setDueTime] = useState(initial?.due_time ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);

  const toggleDay = (d: number) => setDaysOfWeek((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  const toggleAssignee = (uid: string) => setAssignees((cur) => cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit chore" : "New chore"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) { toast.error("Title required"); return; }
          if (recurrence === "weekly" && daysOfWeek.length === 0) { toast.error("Pick at least one day"); return; }
          onSubmit({
            title: title.trim(), notes: notes || null, category, recurrence,
            days_of_week: recurrence === "weekly" ? daysOfWeek : [],
            day_of_month: recurrence === "monthly" ? dayOfMonth : null,
            due_time: dueTime || null,
            start_date: startDate, end_date: endDate || null, active,
          }, assignees);
        }}
        className="space-y-3"
      >
        <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as "daily" | "weekly" | "monthly")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {recurrence === "weekly" && (
          <div>
            <Label>Days of week</Label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {DAY_LABELS.map((label, idx) => (
                <button
                  type="button" key={idx} onClick={() => toggleDay(idx)}
                  className={`px-2.5 py-1 rounded border text-xs ${daysOfWeek.includes(idx) ? "border-primary bg-primary/10" : "border-border"}`}
                >{label}</button>
              ))}
            </div>
          </div>
        )}

        {recurrence === "monthly" && (
          <div>
            <Label>Day of month (1–31)</Label>
            <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div><Label>Due time</Label><Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></div>
          <div><Label>Starts</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label>Ends</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>

        <div>
          <Label>Assignees</Label>
          {profiles.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">No users to assign.</p>
          ) : (
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto mt-1">
              {profiles.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted">
                  <Checkbox checked={assignees.includes(p.id)} onCheckedChange={() => toggleAssignee(p.id)} />
                  <span className="text-sm">{p.display_name ?? p.id.slice(0, 8)}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{assignees.length} selected</p>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Active</Label>
        </div>

        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
