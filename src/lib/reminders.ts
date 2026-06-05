import { addDays, differenceInDays, isBefore, parseISO } from "date-fns";

export type Severity = "info" | "warning" | "urgent";
export type Reminder = {
  id: string;
  kind: "heat" | "breeding" | "pregnancy" | "due" | "feed" | "task" | "compost" | "garden" | "bill" | "barter" | "hatch";
  severity: Severity;
  title: string;
  subtitle: string;
  date?: string; // ISO
  link: { to: string; params?: Record<string, string> };
};

type AnimalRow = { id: string; name: string; sex: string; species: string; status: string };
type HeatRow = { id: string; animal_id: string; event_date: string };
type PregRow = { id: string; animal_id: string; status: string; expected_due: string | null; bred_date: string };
type FeedRow = { id: string; name: string; stock_qty: number; low_stock_threshold: number };
type BillRow = { id: string; name: string; due_date: string | null; paid: boolean };
type TaskRow = { id: string; title: string; due_date: string | null; completed: boolean };
type GardenRow = { id: string; name: string; crop: string | null; status: string; last_watered_on: string | null; watering_interval_days: number | null; expected_harvest: string | null };
type CompostRow = { id: string; entry_type: string; entry_date: string };
type BarterRow = { id: string; title: string; status: string; due_date: string | null };
type IncubationRow = { id: string; animal_id: string | null; species: string; expected_hatch: string | null; actual_hatch: string | null };

const HEAT_CYCLE_DAYS: Record<string, number> = { goat: 21, sheep: 17, cow: 21, pig: 21, dog: 180, cat: 14, rabbit: 16 };

export function computeReminders(input: {
  animals?: AnimalRow[];
  heats?: HeatRow[];
  pregnancies?: PregRow[];
  feed?: FeedRow[];
  bills?: BillRow[];
  tasks?: TaskRow[];
  garden?: GardenRow[];
  compost?: CompostRow[];
  barter?: BarterRow[];
}): Reminder[] {
  const today = new Date();
  const out: Reminder[] = [];

  // Heat cycles — for active females, predict next cycle
  const lastHeatByAnimal = new Map<string, string>();
  (input.heats ?? []).forEach((h) => {
    const cur = lastHeatByAnimal.get(h.animal_id);
    if (!cur || cur < h.event_date) lastHeatByAnimal.set(h.animal_id, h.event_date);
  });
  (input.animals ?? []).forEach((a) => {
    if (a.sex !== "female" || a.status !== "active") return;
    const cycle = HEAT_CYCLE_DAYS[a.species.toLowerCase()] ?? 21;
    const last = lastHeatByAnimal.get(a.id);
    if (!last) return;
    const next = addDays(parseISO(last), cycle);
    const days = differenceInDays(next, today);
    if (days <= 3 && days >= -2) {
      out.push({
        id: `heat-${a.id}`,
        kind: "heat",
        severity: days <= 0 ? "warning" : "info",
        title: `${a.name} heat expected`,
        subtitle: days <= 0 ? `Due ${Math.abs(days)}d ago` : `In ${days}d`,
        date: next.toISOString(),
        link: { to: "/animals/$animalId", params: { animalId: a.id } },
      });
    }
  });

  // Pregnancies
  (input.pregnancies ?? []).forEach((p) => {
    const a = (input.animals ?? []).find((x) => x.id === p.animal_id);
    if (!a) return;
    if (p.status === "suspected") {
      const days = differenceInDays(today, parseISO(p.bred_date));
      if (days >= 21) {
        out.push({
          id: `breed-${p.id}`,
          kind: "breeding",
          severity: "info",
          title: `Confirm pregnancy: ${a.name}`,
          subtitle: `Bred ${days}d ago`,
          link: { to: "/animals/$animalId", params: { animalId: a.id } },
        });
      }
    }
    if ((p.status === "active" || p.status === "confirmed") && p.expected_due) {
      const due = parseISO(p.expected_due);
      const days = differenceInDays(due, today);
      if (days <= 14 && days >= -3) {
        out.push({
          id: `due-${p.id}`,
          kind: "pregnancy",
          severity: days <= 3 ? "urgent" : days <= 7 ? "warning" : "info",
          title: `${a.name} due soon`,
          subtitle: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `In ${days}d`,
          date: due.toISOString(),
          link: { to: "/animals/$animalId", params: { animalId: a.id } },
        });
      }
    }
  });

  // Feed restock
  (input.feed ?? []).forEach((f) => {
    if (Number(f.low_stock_threshold) > 0 && Number(f.stock_qty) <= Number(f.low_stock_threshold)) {
      out.push({
        id: `feed-${f.id}`,
        kind: "feed",
        severity: Number(f.stock_qty) <= 0 ? "urgent" : "warning",
        title: `Low feed: ${f.name}`,
        subtitle: `${f.stock_qty} left`,
        link: { to: "/feed" },
      });
    }
  });

  // Bills
  (input.bills ?? []).forEach((b) => {
    if (b.paid || !b.due_date) return;
    const days = differenceInDays(parseISO(b.due_date), today);
    if (days <= 14) {
      out.push({
        id: `bill-${b.id}`,
        kind: "bill",
        severity: days < 0 ? "urgent" : days <= 3 ? "warning" : "info",
        title: `Bill: ${b.name}`,
        subtitle: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`,
        date: b.due_date,
        link: { to: "/bills" },
      });
    }
  });

  // Tasks
  (input.tasks ?? []).forEach((t) => {
    if (t.completed || !t.due_date) return;
    const days = differenceInDays(parseISO(t.due_date), today);
    if (days <= 7) {
      out.push({
        id: `task-${t.id}`,
        kind: "task",
        severity: days < 0 ? "urgent" : days <= 1 ? "warning" : "info",
        title: t.title,
        subtitle: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `In ${days}d`,
        date: t.due_date,
        link: { to: "/tasks" },
      });
    }
  });

  // Compost — last turn > 7d ago
  const turns = (input.compost ?? []).filter((c) => c.entry_type === "turn").map((c) => c.entry_date).sort();
  if (turns.length > 0) {
    const last = turns[turns.length - 1];
    const days = differenceInDays(today, parseISO(last));
    if (days >= 7) {
      out.push({
        id: `compost-turn`,
        kind: "compost",
        severity: days >= 14 ? "warning" : "info",
        title: "Turn the compost",
        subtitle: `Last turned ${days}d ago`,
        link: { to: "/compost" },
      });
    }
  }

  // Garden — water + harvest
  (input.garden ?? []).forEach((g) => {
    if (g.status === "harvested") return;
    if (g.watering_interval_days && g.last_watered_on) {
      const next = addDays(parseISO(g.last_watered_on), g.watering_interval_days);
      const days = differenceInDays(next, today);
      if (days <= 0) {
        out.push({
          id: `water-${g.id}`,
          kind: "garden",
          severity: days < -2 ? "warning" : "info",
          title: `Water ${g.name}`,
          subtitle: days === 0 ? "Today" : `${Math.abs(days)}d overdue`,
          link: { to: "/garden" },
        });
      }
    }
    if (g.expected_harvest) {
      const days = differenceInDays(parseISO(g.expected_harvest), today);
      if (days <= 7 && days >= -3) {
        out.push({
          id: `harvest-${g.id}`,
          kind: "garden",
          severity: "info",
          title: `Harvest ${g.crop ?? g.name}`,
          subtitle: days < 0 ? `${Math.abs(days)}d past` : days === 0 ? "Today" : `In ${days}d`,
          date: g.expected_harvest,
          link: { to: "/garden" },
        });
      }
    }
  });

  // Barter due
  (input.barter ?? []).forEach((b) => {
    if (b.status !== "pending" || !b.due_date) return;
    const days = differenceInDays(parseISO(b.due_date), today);
    if (days <= 7) {
      out.push({
        id: `barter-${b.id}`,
        kind: "barter",
        severity: days < 0 ? "urgent" : days <= 1 ? "warning" : "info",
        title: `Trade: ${b.title}`,
        subtitle: days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${Math.max(0, days)}d`,
        date: b.due_date,
        link: { to: "/barter" },
      });
    }
  });

  // Sort: urgent first, then by date
  const sevOrder: Record<Severity, number> = { urgent: 0, warning: 1, info: 2 };
  out.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
  return out;
}

export function severityClass(s: Severity): string {
  if (s === "urgent") return "bg-destructive text-destructive-foreground border-transparent";
  if (s === "warning") return "bg-warning text-warning-foreground border-transparent";
  return "bg-secondary text-secondary-foreground border-transparent";
}
