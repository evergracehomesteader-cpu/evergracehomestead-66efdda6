import { describe, expect, it } from "vitest";
import {
  computeTaskNotifications,
  isChoreScheduledOn,
  DUE_SOON_DAYS,
  type NotifChore,
  type TaskNotifInput,
} from "../task-notifications";

// Fixed "now": Tuesday 2026-10-13 12:00 local.
const NOW = new Date(2026, 9, 13, 12, 0, 0);
const USER = "user-1";

function chore(overrides: Partial<NotifChore> = {}): NotifChore {
  return {
    id: "chore-1",
    title: "Morning feed",
    recurrence: "daily",
    days_of_week: [],
    day_of_month: null,
    due_time: null,
    start_date: "2026-01-01",
    end_date: null,
    active: true,
    ...overrides,
  };
}

function baseInput(overrides: Partial<TaskNotifInput> = {}): TaskNotifInput {
  return {
    userId: USER,
    chores: [],
    assignments: [],
    completionsToday: [],
    completionsYesterday: [],
    tasks: [],
    assignmentWatermark: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isChoreScheduledOn", () => {
  it("matches daily/weekly/monthly rules", () => {
    expect(isChoreScheduledOn(chore(), "2026-10-13")).toBe(true);
    expect(
      isChoreScheduledOn(chore({ recurrence: "weekly", days_of_week: [3] }), "2026-10-13"),
    ).toBe(false); // Tuesday, not Wednesday
    expect(
      isChoreScheduledOn(chore({ recurrence: "weekly", days_of_week: [2] }), "2026-10-13"),
    ).toBe(true);
    expect(
      isChoreScheduledOn(chore({ recurrence: "monthly", day_of_month: 13 }), "2026-10-13"),
    ).toBe(true);
    expect(
      isChoreScheduledOn(chore({ recurrence: "monthly", day_of_month: 14 }), "2026-10-13"),
    ).toBe(false);
  });

  it("respects active flag and date range", () => {
    expect(isChoreScheduledOn(chore({ active: false }), "2026-10-13")).toBe(false);
    expect(isChoreScheduledOn(chore({ start_date: "2026-10-14" }), "2026-10-13")).toBe(false);
    expect(isChoreScheduledOn(chore({ end_date: "2026-10-12" }), "2026-10-13")).toBe(false);
  });
});

describe("assigned notifications", () => {
  // Saturday-only chore: not scheduled Mon 10-13 or Sun 10-12, so only
  // "assigned" notifications fire in these tests.
  const c = chore({ recurrence: "weekly", days_of_week: [6] });
  const asg = (id: string, created_at: string) => ({
    id,
    chore_id: c.id,
    user_id: USER,
    created_at,
  });

  it("notifies for assignments newer than the watermark", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({ chores: [c], assignments: [asg("a1", "2026-10-13T08:00:00Z")] }),
      NOW,
    );
    expect(notifications.map((n) => n.id)).toContain("assigned:a1");
    expect(notifications[0].kind).toBe("assigned");
  });

  it("ignores assignments at/before the watermark", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({
        chores: [c],
        assignments: [asg("a1", "2026-09-01T00:00:00Z")],
      }),
      NOW,
    );
    expect(notifications.some((n) => n.id === "assigned:a1")).toBe(false);
  });

  it("baselines on first run instead of spamming old assignments", () => {
    const { notifications, newWatermark } = computeTaskNotifications(
      baseInput({
        chores: [c],
        assignments: [asg("a1", "2026-09-01T00:00:00Z")],
        assignmentWatermark: null,
      }),
      NOW,
    );
    expect(notifications.some((n) => n.kind === "assigned")).toBe(false);
    expect(newWatermark).toBe("2026-09-01T00:00:00Z");
  });

  it("skips assignments for other users and inactive chores", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({
        chores: [c, chore({ id: "chore-2", active: false })],
        assignments: [
          { id: "a1", chore_id: c.id, user_id: "someone-else", created_at: "2026-10-13T08:00:00Z" },
          { id: "a2", chore_id: "chore-2", user_id: USER, created_at: "2026-10-13T08:00:00Z" },
        ],
      }),
      NOW,
    );
    expect(notifications.some((n) => n.kind === "assigned")).toBe(false);
  });
});

describe("recurring chore due/overdue/missed", () => {
  const c = chore({ due_time: "18:00" });
  const mine = [{ id: "a1", chore_id: c.id, user_id: USER, created_at: "2026-09-01T00:00:00Z" }];

  it("flags today's incomplete assigned chore as due-soon", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({ chores: [c], assignments: mine }),
      NOW, // noon, due 18:00 not yet passed
    );
    const n = notifications.find((x) => x.id === "due:chore-1:2026-10-13");
    expect(n).toBeDefined();
    expect(n!.severity).toBe("warning");
  });

  it("flags it overdue once today's due_time has passed", () => {
    const evening = new Date(2026, 9, 13, 19, 0, 0);
    const { notifications } = computeTaskNotifications(
      baseInput({ chores: [c], assignments: mine }),
      evening,
    );
    const n = notifications.find((x) => x.id === "overdue:chore-1:2026-10-13");
    expect(n).toBeDefined();
    expect(n!.severity).toBe("critical");
    expect(notifications.some((x) => x.id === "due:chore-1:2026-10-13")).toBe(false);
  });

  it("stays silent when today's instance is complete", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({
        chores: [c],
        assignments: mine,
        completionsToday: [{ chore_id: c.id, instance_date: "2026-10-13" }],
      }),
      NOW,
    );
    expect(
      notifications.some((x) => x.id.startsWith("due:") || x.id.startsWith("overdue:")),
    ).toBe(false);
  });

  it("flags yesterday's scheduled-but-incomplete chore as missed", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({ chores: [c], assignments: mine }),
      NOW,
    );
    // 2026-10-12 was a Monday; daily chore was scheduled, no completion → missed
    const n = notifications.find((x) => x.id === "missed:chore-1:2026-10-12");
    expect(n).toBeDefined();
    expect(n!.severity).toBe("critical");
  });

  it("does not flag missed when yesterday was completed", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({
        chores: [c],
        assignments: mine,
        completionsYesterday: [{ chore_id: c.id, instance_date: "2026-10-12" }],
      }),
      NOW,
    );
    expect(notifications.some((x) => x.kind === "missed")).toBe(false);
  });

  it("ignores chores not assigned to the current user", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({ chores: [c], assignments: [] }),
      NOW,
    );
    expect(notifications.length).toBe(0);
  });
});

describe("one-time tasks", () => {
  it("flags tasks due today/tomorrow as due-soon, past-due as overdue", () => {
    expect(DUE_SOON_DAYS).toBe(2);
    const { notifications } = computeTaskNotifications(
      baseInput({
        tasks: [
          { id: "t1", title: "Fix fence", due_date: "2026-10-13", completed: false },
          { id: "t2", title: "Order feed", due_date: "2026-10-14", completed: false },
          { id: "t3", title: "Call vet", due_date: "2026-10-10", completed: false },
          { id: "t4", title: "Done thing", due_date: "2026-10-10", completed: true },
          { id: "t5", title: "No date", due_date: null, completed: false },
          { id: "t6", title: "Next week", due_date: "2026-10-20", completed: false },
        ],
      }),
      NOW,
    );
    const ids = notifications.map((n) => n.id);
    expect(ids).toContain("task-due:t1");
    expect(ids).toContain("task-due:t2");
    expect(ids).toContain("task-overdue:t3");
    expect(ids).not.toContain("task-overdue:t4");
    expect(ids).not.toContain("task-due:t5");
    expect(ids).not.toContain("task-due:t6");
    expect(ids).not.toContain("task-overdue:t6");
  });

  it("one-time notifications show for signed-out users too", () => {
    const { notifications } = computeTaskNotifications(
      baseInput({
        userId: null,
        tasks: [{ id: "t1", title: "Fix fence", due_date: "2026-10-10", completed: false }],
      }),
      NOW,
    );
    expect(notifications.map((n) => n.id)).toContain("task-overdue:t1");
  });
});

describe("ordering and dedup", () => {
  it("orders critical before warning before info", () => {
    const c = chore();
    const { notifications } = computeTaskNotifications(
      baseInput({
        chores: [c],
        assignments: [
          { id: "a1", chore_id: c.id, user_id: USER, created_at: "2026-10-13T08:00:00Z" },
        ],
        tasks: [{ id: "t3", title: "Call vet", due_date: "2026-10-10", completed: false }],
      }),
      NOW,
    );
    const kinds = notifications.map((n) => n.kind);
    // overdue (critical) first, then due-soon (warning), then assigned (info)
    expect(kinds.indexOf("overdue")).toBeLessThan(kinds.indexOf("due-soon"));
    expect(kinds.indexOf("due-soon")).toBeLessThan(kinds.indexOf("assigned"));
  });

  it("produces stable ids across runs (dedup-safe)", () => {
    const input = baseInput({
      chores: [chore()],
      assignments: [
        { id: "a1", chore_id: "chore-1", user_id: USER, created_at: "2026-10-13T08:00:00Z" },
      ],
      tasks: [{ id: "t1", title: "Fix fence", due_date: "2026-10-10", completed: false }],
    });
    const a = computeTaskNotifications(input, NOW).notifications.map((n) => n.id);
    const b = computeTaskNotifications(input, NOW).notifications.map((n) => n.id);
    expect(a).toEqual(b);
  });
});
