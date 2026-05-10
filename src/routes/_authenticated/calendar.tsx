import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Heart, Baby, Receipt, Handshake, ListTodo } from "lucide-react";
import { format, parseISO, isSameDay, addDays } from "date-fns";
import { gestationFor } from "@/lib/homestead";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type Event = {
  date: Date;
  kind: "heat" | "breeding" | "due" | "birth" | "bill" | "task" | "barter";
  label: string;
  link: { to: string; params?: Record<string, string> };
};

const HEAT_CYCLE: Record<string, number> = { goat: 21, sheep: 17, cow: 21, pig: 21, dog: 180, cat: 14, rabbit: 16 };

function CalendarPage() {
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const { data: animals } = useQuery({
    queryKey: ["cal-animals"],
    queryFn: async () => (await supabase.from("animals").select("id,name,sex,species,status")).data ?? [],
  });
  const { data: heats } = useQuery({
    queryKey: ["cal-heats"],
    queryFn: async () => (await supabase.from("heat_events").select("*")).data ?? [],
  });
  const { data: pregs } = useQuery({
    queryKey: ["cal-pregs"],
    queryFn: async () => (await supabase.from("pregnancies").select("*")).data ?? [],
  });
  const { data: bills } = useQuery({
    queryKey: ["cal-bills"],
    queryFn: async () => (await supabase.from("bills").select("*").eq("paid", false)).data ?? [],
  });
  const { data: tasks } = useQuery({
    queryKey: ["cal-tasks"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: boolean) => Promise<{ data: { id: string; title: string; due_date: string | null; completed: boolean }[] }> } } };
      return (await c.from("tasks").select("*").eq("completed", false)).data ?? [];
    },
  });
  const { data: barter } = useQuery({
    queryKey: ["cal-barter"],
    queryFn: async () => (await supabase.from("barter_deals").select("*").eq("status", "pending")).data ?? [],
  });

  const events: Event[] = useMemo(() => {
    const out: Event[] = [];
    const animById = new Map((animals ?? []).map((a) => [a.id, a]));

    // Past heats
    (heats ?? []).forEach((h) => {
      const a = animById.get(h.animal_id);
      if (!a) return;
      out.push({
        date: parseISO(h.event_date), kind: "heat",
        label: `${a.name} heat`,
        link: { to: "/animals/$animalId", params: { animalId: a.id } },
      });
    });

    // Predicted next heat (active females)
    const lastHeat = new Map<string, string>();
    (heats ?? []).forEach((h) => {
      const cur = lastHeat.get(h.animal_id);
      if (!cur || cur < h.event_date) lastHeat.set(h.animal_id, h.event_date);
    });
    (animals ?? []).forEach((a) => {
      if (a.sex !== "female" || a.status !== "active") return;
      const last = lastHeat.get(a.id);
      if (!last) return;
      const cycle = HEAT_CYCLE[a.species.toLowerCase()] ?? 21;
      const next = addDays(parseISO(last), cycle);
      out.push({
        date: next, kind: "heat",
        label: `${a.name} heat (predicted)`,
        link: { to: "/animals/$animalId", params: { animalId: a.id } },
      });
    });

    // Pregnancies
    (pregs ?? []).forEach((p) => {
      const a = animById.get(p.animal_id);
      if (!a) return;
      out.push({
        date: parseISO(p.bred_date), kind: "breeding",
        label: `${a.name} bred`,
        link: { to: "/animals/$animalId", params: { animalId: a.id } },
      });
      if (p.expected_due) {
        out.push({
          date: parseISO(p.expected_due), kind: "due",
          label: `${a.name} due`,
          link: { to: "/animals/$animalId", params: { animalId: a.id } },
        });
      } else if (p.bred_date) {
        const due = addDays(parseISO(p.bred_date), gestationFor(a.species));
        out.push({
          date: due, kind: "due",
          label: `${a.name} estimated due`,
          link: { to: "/animals/$animalId", params: { animalId: a.id } },
        });
      }
      if (p.actual_birth) {
        out.push({
          date: parseISO(p.actual_birth), kind: "birth",
          label: `${a.name} delivered${p.offspring_count != null ? ` ${p.offspring_count}` : ""}`,
          link: { to: "/animals/$animalId", params: { animalId: a.id } },
        });
      }
    });

    (bills ?? []).forEach((b) => {
      if (!b.due_date) return;
      out.push({ date: parseISO(b.due_date), kind: "bill", label: `Bill: ${b.name}`, link: { to: "/bills" } });
    });
    (tasks ?? []).forEach((t) => {
      if (!t.due_date) return;
      out.push({ date: parseISO(t.due_date), kind: "task", label: t.title, link: { to: "/tasks" } });
    });
    (barter ?? []).forEach((b) => {
      if (!b.due_date) return;
      out.push({ date: parseISO(b.due_date), kind: "barter", label: `Trade: ${b.title}`, link: { to: "/barter" } });
    });

    return out;
  }, [animals, heats, pregs, bills, tasks, barter]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, Event[]>();
    events.forEach((e) => {
      const k = format(e.date, "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    });
    return m;
  }, [events]);

  const modifiers = {
    heat: events.filter((e) => e.kind === "heat").map((e) => e.date),
    breeding: events.filter((e) => e.kind === "breeding" || e.kind === "due").map((e) => e.date),
    bill: events.filter((e) => e.kind === "bill").map((e) => e.date),
    task: events.filter((e) => e.kind === "task" || e.kind === "barter").map((e) => e.date),
    birth: events.filter((e) => e.kind === "birth").map((e) => e.date),
  };

  const dayEvents = selected ? events.filter((e) => isSameDay(e.date, selected)) : [];

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-display font-semibold">Calendar</h1>
        <p className="text-muted-foreground">Heats, breeding, due dates, bills, and tasks.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-3 flex justify-center">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            month={month}
            onMonthChange={setMonth}
            modifiers={modifiers}
            modifiersClassNames={{
              heat: "bg-accent/30 font-semibold",
              breeding: "bg-primary/20 font-semibold",
              bill: "ring-1 ring-warning",
              task: "underline decoration-2 decoration-primary",
              birth: "bg-success/30 font-semibold",
            }}
            className="pointer-events-auto"
          />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="font-display text-lg font-semibold">
            {selected ? format(selected, "EEEE, MMM d") : "Select a day"}
          </div>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {dayEvents.map((e, i) => (
                <li key={i}>
                  <Link to={e.link.to} params={e.link.params as never} className="flex items-start gap-2 text-sm hover:bg-accent rounded-md p-2 -m-2">
                    <EventIcon kind={e.kind} />
                    <span className="flex-1">{e.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-3 border-t flex flex-wrap gap-2 text-xs">
            <Legend className="bg-accent/30" label="Heat" />
            <Legend className="bg-primary/20" label="Breeding/due" />
            <Legend className="bg-success/30" label="Birth" />
            <Legend className="ring-1 ring-warning" label="Bill" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function EventIcon({ kind }: { kind: Event["kind"] }) {
  const cls = "h-4 w-4 mt-0.5 flex-shrink-0";
  if (kind === "heat") return <Heart className={`${cls} text-accent`} />;
  if (kind === "birth") return <Baby className={`${cls} text-success`} />;
  if (kind === "bill") return <Receipt className={`${cls} text-warning`} />;
  if (kind === "barter") return <Handshake className={`${cls} text-primary`} />;
  if (kind === "task") return <ListTodo className={`${cls} text-primary`} />;
  return <Heart className={`${cls} text-primary`} />;
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Badge variant="outline" className={`h-4 w-4 p-0 ${className}`} />
      {label}
    </span>
  );
}
