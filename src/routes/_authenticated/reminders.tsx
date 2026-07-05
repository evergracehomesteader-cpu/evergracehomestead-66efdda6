import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { computeReminders, severityClass } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/reminders")({ component: RemindersPage });

function RemindersPage() {
  const animals = useQuery({ queryKey: ["rem-animals"], queryFn: async () => (await supabase.from("animals").select("id,name,sex,species,status")).data ?? [] });
  const heats = useQuery({ queryKey: ["rem-heats"], queryFn: async () => (await supabase.from("heat_events").select("id,animal_id,event_date")).data ?? [] });
  const pregs = useQuery({ queryKey: ["rem-pregs"], queryFn: async () => (await supabase.from("pregnancies").select("id,animal_id,status,expected_due,bred_date")).data ?? [] });
  const feed = useQuery({ queryKey: ["rem-feed"], queryFn: async () => (await supabase.from("feed_items").select("id,name,stock_qty,low_stock_threshold")).data ?? [] });
  const bills = useQuery({ queryKey: ["rem-bills"], queryFn: async () => (await supabase.from("bills").select("id,name,due_date,paid").eq("paid", false)).data ?? [] });
  const tasks = useQuery({
    queryKey: ["rem-tasks"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => { eq: (col: string, v: boolean) => Promise<{ data: { id: string; title: string; due_date: string | null; completed: boolean }[] }> } } };
      return (await c.from("tasks").select("id,title,due_date,completed").eq("completed", false)).data ?? [];
    },
  });
  const garden = useQuery({ queryKey: ["rem-garden"], queryFn: async () => (await supabase.from("garden_plots").select("*")).data ?? [] });
  const compost = useQuery({ queryKey: ["rem-compost"], queryFn: async () => (await supabase.from("compost_entries").select("id,entry_type,entry_date")).data ?? [] });
  const barter = useQuery({ queryKey: ["rem-barter"], queryFn: async () => (await supabase.from("barter_deals").select("id,title,status,due_date").eq("status", "pending")).data ?? [] });
  const incubations = useQuery({
    queryKey: ["rem-incubations"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => { is: (col: string, v: null) => Promise<{ data: { id: string; animal_id: string | null; species: string; expected_hatch: string | null; actual_hatch: string | null }[] }> } } };
      return (await c.from("incubations").select("id,animal_id,species,expected_hatch,actual_hatch").is("actual_hatch", null)).data ?? [];
    },
  });

  const reminders = computeReminders({
    animals: animals.data, heats: heats.data, pregnancies: pregs.data, feed: feed.data,
    bills: bills.data, tasks: tasks.data, garden: garden.data, compost: compost.data, barter: barter.data, incubations: incubations.data,
  });

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-3xl font-display font-semibold">Reminders</h1>
        <p className="text-muted-foreground">Everything coming up across the homestead.</p>
      </div>

      {reminders.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">All caught up. Nothing needs attention right now.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {reminders.map((r) => (
              <li key={r.id}>
                <Link to={r.link.to} params={r.link.params as never} className="px-4 py-3 flex items-start gap-3 hover:bg-accent">
                  <Badge className={severityClass(r.severity)}>{r.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.subtitle} · {r.kind}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
