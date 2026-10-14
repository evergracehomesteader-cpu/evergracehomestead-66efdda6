// In-app task/chore notifications, computed from local data (works offline).
//
// The app has no push-notification infrastructure, so notifications are
// generated on-device from the Dexie mirror / React Query cache whenever the
// header bell renders. Phone push is a separate future phase; this module's
// event model is designed so the same kinds can drive pushes later.
//
// Design notes:
//   - Pure functions only (no fetch, no React, no localStorage) so the
//     generation logic is unit testable. See
//     src/lib/__tests__/task-notifications.test.ts. Persistence (watermarks,
//     read state) lives in the UI layer (src/components/NotificationBell.tsx).
//   - Notification IDs are deterministic per (kind, entity, instance date), so
//     re-running generation never duplicates. Read/unread is a separate
//     localStorage set of IDs maintained by the UI.
//   - One-time tasks have no assignee field in the schema, so their due/overdue
//     notifications are shown to every user of the homestead (documented
//     limitation — adding assignees would need a schema change).
//   - Recurring-chore notifications are scoped to chores assigned to the
//     current user via chore_assignments.

import { parseDateOnly, toISODateOnly } from "./dates";

export type TaskNotifSeverity = "critical" | "warning" | "info";
export type TaskNotifKind = "assigned" | "due-soon" | "overdue" | "missed";

export interface TaskNotification {
  /** Deterministic: `${kind}:${entity}:${instance}` — stable across runs. */
  id: string;
  kind: TaskNotifKind;
  severity: TaskNotifSeverity;
  title: string;
  /** Plain-language detail. */
  detail: string;
  /** Route to open when tapped. */
  to: "/chores";
  /** Search params for the route (e.g. one-time tab). Always present so
   * TanStack Router's strict search typing is satisfied. */
  search: { tab: "one-time" | undefined };
}

export interface NotifChore {
  id: string;
  title: string;
  recurrence: "daily" | "weekly" | "monthly";
  days_of_week: number[];
  day_of_month: number | null;
  due_time: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

export interface NotifAssignment {
  id: string;
  chore_id: string;
  user_id: string;
  /** ISO timestamp. */
  created_at: string;
}

export interface NotifCompletion {
  chore_id: string;
  /** yyyy-mm-dd */
  instance_date: string;
}

export interface NotifTask {
  id: string;
  title: string;
  /** yyyy-mm-dd or null */
  due_date: string | null;
  completed: boolean;
}

export interface TaskNotifInput {
  /** Current user id, or null (demo / signed out) — recurring items need one. */
  userId: string | null;
  chores: NotifChore[];
  assignments: NotifAssignment[];
  /** Completions whose instance_date is today (yyyy-mm-dd). */
  completionsToday: NotifCompletion[];
  /** Completions whose instance_date is yesterday (yyyy-mm-dd). */
  completionsYesterday: NotifCompletion[];
  tasks: NotifTask[];
  /**
   * ISO-timestamp watermark: assignments created at/before this were already
   * surfaced. Null on first run — we baseline instead of notifying for every
   * old assignment (documented choice).
   */
  assignmentWatermark: string | null;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * One-time tasks due today or within this many days after today count as
 * "due soon". 2 = today + tomorrow: enough runway to plan tonight's/tomorrow's
 * work, short enough not to cry wolf about next week's list.
 */
export const DUE_SOON_DAYS = 2;

// ---------------------------------------------------------------------------
// Scheduling helper (shared with the Chores page)
// ---------------------------------------------------------------------------

/**
 * Is this chore scheduled on the given yyyy-mm-dd date? Same rules as the
 * Chores page "Today" tab: active, within start/end dates, and matching the
 * recurrence pattern. Date strings compare lexicographically (yyyy-mm-dd).
 */
export function isChoreScheduledOn(chore: NotifChore, dateStr: string): boolean {
  if (!chore.active) return false;
  if (chore.start_date > dateStr) return false;
  if (chore.end_date && chore.end_date < dateStr) return false;
  const d = parseDateOnly(dateStr);
  if (chore.recurrence === "daily") return true;
  if (chore.recurrence === "weekly") return (chore.days_of_week ?? []).includes(d.getDay());
  if (chore.recurrence === "monthly") return chore.day_of_month === d.getDate();
  return false;
}

/** "HH:MM" 24h local time, for comparing due_time ("14:30") against now. */
function nowHM(now: Date): string {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function shortDate(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysBetween(a: string, b: string): number {
  const ms = parseDateOnly(b).getTime() - parseDateOnly(a).getTime();
  return Math.round(ms / 86_400_000);
}

export interface TaskNotifResult {
  notifications: TaskNotification[];
  /**
   * Updated assignment watermark: max created_at seen (or the input watermark,
   * or now on first run). The UI persists this.
   */
  newWatermark: string;
}

/**
 * Generate in-app notifications from local chore/task data. `now` is
 * injectable for tests. Returns notifications ordered critical → warning →
 * info, newest first within each severity.
 */
export function computeTaskNotifications(
  input: TaskNotifInput,
  now: Date = new Date(),
): TaskNotifResult {
  const today = toISODateOnly(now);
  const yest = toISODateOnly(new Date(now.getTime() - 86_400_000));
  const choreById = new Map(input.chores.map((c) => [c.id, c]));
  const doneToday = new Set(input.completionsToday.map((c) => c.chore_id));
  const doneYesterday = new Set(input.completionsYesterday.map((c) => c.chore_id));

  const notifs: TaskNotification[] = [];

  // ---- Assigned to you: new chore_assignments since the watermark ----
  // First run (watermark null): baseline, don't notify for old assignments.
  let watermark = input.assignmentWatermark;
  if (input.userId) {
    const mine = input.assignments
      .filter((a) => a.user_id === input.userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (watermark === null) {
      watermark =
        mine.length > 0 ? mine[0].created_at : now.toISOString();
    } else {
      for (const a of mine) {
        if (a.created_at <= watermark) break; // sorted desc — rest are older
        const chore = choreById.get(a.chore_id);
        if (!chore || !chore.active) continue;
        const startsFuture = chore.start_date > today;
        notifs.push({
          id: `assigned:${a.id}`,
          kind: "assigned",
          severity: "info",
          title: `New chore assigned: ${chore.title}`,
          detail: startsFuture
            ? `Starts ${shortDate(chore.start_date)} — it'll show up in your list then.`
            : `It's on your chores list now.`,
          to: "/chores",
         search: { tab: undefined },
        });
      }
      if (mine.length > 0 && mine[0].created_at > watermark) {
        watermark = mine[0].created_at;
      }
    }
  }
  const newWatermark = watermark ?? now.toISOString();

  const myChoreIds = new Set(
    input.userId
      ? input.assignments.filter((a) => a.user_id === input.userId).map((a) => a.chore_id)
      : [],
  );

  // ---- Recurring chores: due today / overdue today / missed yesterday ----
  if (input.userId) {
    for (const chore of input.chores) {
      if (!chore.active || !myChoreIds.has(chore.id)) continue;

      // Due today, still open.
      if (isChoreScheduledOn(chore, today) && !doneToday.has(chore.id)) {
        const dueLabel = chore.due_time ? ` by ${chore.due_time.slice(0, 5)}` : "";
        if (chore.due_time && chore.due_time.slice(0, 5) < nowHM(now)) {
          // Due time already passed today → overdue.
          notifs.push({
            id: `overdue:${chore.id}:${today}`,
            kind: "overdue",
            severity: "critical",
            title: `Overdue: ${chore.title}`,
            detail: `Was due ${chore.due_time.slice(0, 5)} today and isn't done yet.`,
            to: "/chores",
          search: { tab: undefined },
          });
        } else {
          notifs.push({
            id: `due:${chore.id}:${today}`,
            kind: "due-soon",
            severity: "warning",
            title: `Due today: ${chore.title}`,
            detail: `Still open${dueLabel}.`,
            to: "/chores",
          search: { tab: undefined },
          });
        }
      }

      // Missed yesterday: scheduled, assigned, no completion recorded.
      if (isChoreScheduledOn(chore, yest) && !doneYesterday.has(chore.id)) {
        notifs.push({
          id: `missed:${chore.id}:${yest}`,
          kind: "missed",
          severity: "critical",
          title: `Missed yesterday: ${chore.title}`,
          detail: `No completion was recorded for ${shortDate(yest)}.`,
          to: "/chores",
         search: { tab: undefined },
        });
      }
    }
  }

  // ---- One-time tasks: due soon / overdue (shown to everyone — tasks have
  // no assignee field, so they can't be scoped per user) ----
  for (const t of input.tasks) {
    if (t.completed || !t.due_date) continue;
    const delta = daysBetween(today, t.due_date);
    if (delta < 0) {
      notifs.push({
        id: `task-overdue:${t.id}`,
        kind: "overdue",
        severity: "critical",
        title: `Overdue task: ${t.title}`,
        detail: `Was due ${shortDate(t.due_date)}.`,
        to: "/chores",
        search: { tab: "one-time" },
      });
    } else if (delta < DUE_SOON_DAYS) {
      notifs.push({
        id: `task-due:${t.id}`,
        kind: "due-soon",
        severity: "warning",
        title: `Task due ${delta === 0 ? "today" : "tomorrow"}: ${t.title}`,
        detail: delta === 0 ? `Due today.` : `Due ${shortDate(t.due_date)}.`,
        to: "/chores",
        search: { tab: "one-time" },
      });
    }
  }

  const rank: Record<TaskNotifSeverity, number> = { critical: 0, warning: 1, info: 2 };
  notifs.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.id < b.id ? 1 : -1));
  return { notifications: notifs, newWatermark };
}
