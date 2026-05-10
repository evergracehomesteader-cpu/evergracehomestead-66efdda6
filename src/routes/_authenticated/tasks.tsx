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
import { Plus, ListTodo, Trash2 } from "lucide-react";
import { format, isBefore, parseISO } from "date-fns";
import { toast } from "sonner";
import { SearchBar, FilterChips } from "@/components/SearchFilter";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

type Task = {
  id: string; title: string; notes: string | null; due_date: string | null;
  completed: boolean; completed_at: string | null; category: string;
};

const CATEGORIES = ["general", "animal", "garden", "compost", "feed", "bill"];

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"open" | "today" | "overdue" | "done" | "all">("open");
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await (supabase as never as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Task[]; error: Error | null }> } } })
        .from("tasks").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Task> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const client = supabase as never as { from: (t: string) => { insert: (r: unknown) => Promise<{ error: Error | null }>; update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> } } };
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await client.from("tasks").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await client.from("tasks").insert({ ...p, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const client = supabase as never as { from: (t: string) => { update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> } } };
      const { error } = await client.from("tasks").update({
        completed: !t.completed,
        completed_at: !t.completed ? new Date().toISOString() : null,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const client = supabase as never as { from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> } } };
      const { error } = await client.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Deleted"); },
  });

  const filtered = useMemo(() => {
    const today = new Date();
    return (tasks ?? []).filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "open") return !t.completed;
      if (filter === "done") return t.completed;
      if (filter === "all") return true;
      if (filter === "overdue") return !t.completed && t.due_date && isBefore(parseISO(t.due_date), today);
      if (filter === "today") return !t.completed && t.due_date === format(today, "yyyy-MM-dd");
      return true;
    });
  }, [tasks, filter, cat, search]);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Tasks</h1>
          <p className="text-muted-foreground">Things to get done around the homestead.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New task</Button></DialogTrigger>
          <TaskForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      <div className="space-y-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search tasks…" />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "today", label: "Today" },
            { value: "overdue", label: "Overdue" },
            { value: "done", label: "Done" },
            { value: "all", label: "All" },
          ]}
        />
        <FilterChips
          value={cat}
          onChange={setCat}
          options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ListTodo className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No tasks match.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {filtered.map((t) => {
              const overdue = !t.completed && t.due_date && isBefore(parseISO(t.due_date), new Date());
              return (
                <li key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <Checkbox checked={t.completed} onCheckedChange={() => toggle.mutate(t)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                    {t.notes && <div className="text-xs text-muted-foreground mt-0.5">{t.notes}</div>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                      {t.due_date && (
                        <Badge variant="outline" className={`text-[10px] ${overdue ? "border-destructive text-destructive" : ""}`}>
                          {format(parseISO(t.due_date), "MMM d")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ConfirmDelete
                    trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
                    title={`Delete "${t.title}"?`}
                    onConfirm={() => del.mutate(t.id)}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TaskForm({ onSubmit, submitting }: { onSubmit: (p: Partial<Task>) => void; submitting: boolean }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [category, setCategory] = useState("general");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) { toast.error("Title required"); return; }
          onSubmit({ title: title.trim(), notes: notes || null, due_date: due || null, category });
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
          <div><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
