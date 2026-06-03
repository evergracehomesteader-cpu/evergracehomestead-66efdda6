import { format, parseISO } from "date-fns";

export type Recurrence = "daily" | "weekly" | "monthly" | "once";

export interface ChoreRow {
  id: string;
  title: string;
  notes: string | null;
  category: string;
  recurrence: Recurrence;
  days_of_week: number[];
  day_of_month: number | null;
  due_time: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChoreAssignment { id: string; chore_id: string; user_id: string }
export interface ChoreCompletion {
  id: string; chore_id: string; instance_date: string;
  completed_by: string | null; completed_at: string; notes: string | null;
}

export const CHORE_CATEGORIES = ["general", "animal", "feed", "garden", "cleaning", "milking", "maintenance"];

export function isDueOnDate(chore: Pick<ChoreRow, "recurrence" | "days_of_week" | "day_of_month" | "start_date" | "end_date" | "active">, dateISO: string): boolean {
  if (!chore.active) return false;
  if (dateISO < chore.start_date) return false;
  if (chore.end_date && dateISO > chore.end_date) return false;
  const d = parseISO(dateISO);
  switch (chore.recurrence) {
    case "daily": return true;
    case "weekly": return chore.days_of_week.includes(d.getDay());
    case "monthly": return chore.day_of_month ? d.getDate() === chore.day_of_month : d.getDate() === parseISO(chore.start_date).getDate();
    case "once": return dateISO === chore.start_date;
    default: return false;
  }
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(c: Pick<ChoreRow, "recurrence" | "days_of_week" | "day_of_month" | "due_time">): string {
  let base: string;
  switch (c.recurrence) {
    case "daily": base = "Daily"; break;
    case "weekly": base = c.days_of_week.length ? `Weekly: ${c.days_of_week.map((d) => DAY_NAMES[d]).join(", ")}` : "Weekly"; break;
    case "monthly": base = `Monthly${c.day_of_month ? ` on day ${c.day_of_month}` : ""}`; break;
    case "once": base = "One-time"; break;
  }
  if (c.due_time) base += ` · ${c.due_time.slice(0, 5)}`;
  return base;
}
