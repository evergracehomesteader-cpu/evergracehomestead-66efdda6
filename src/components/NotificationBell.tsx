// In-app notification bell: task/chore alerts generated on-device from local
// data (works offline via the Dexie mirror). Read/unread state and the
// "new assignment" watermark persist in localStorage — nothing here needs the
// network beyond the normal React Query caches the Chores page already uses.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, CircleAlert, Clock, UserPlus, CalendarX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { todayLocal, toISODateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  computeTaskNotifications,
  type NotifAssignment,
  type NotifChore,
  type NotifCompletion,
  type NotifTask,
  type TaskNotification,
  type TaskNotifKind,
} from "@/lib/task-notifications";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Profile = { id: string; display_name: string | null };

// Loose-typed client (dynamic table names not in generated types).
const db = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: Error | null }>;
    } & Promise<{ data: unknown[] | null; error: Error | null }>;
  };
};

const LS_SEEN = (uid: string) => `hh:notif:assignSeen:${uid}`;
const LS_READ = "hh:notif:read";
const MAX_READ_IDS = 500;

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_READ);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>) {
  const arr = [...ids].slice(-MAX_READ_IDS);
  localStorage.setItem(LS_READ, JSON.stringify(arr));
}

function getWatermark(uid: string): string | null {
  return localStorage.getItem(LS_SEEN(uid));
}

function setWatermark(uid: string, v: string) {
  localStorage.setItem(LS_SEEN(uid), v);
}

function useNotifQuery<T>(key: (string | undefined)[], table: string, map: (r: never) => T) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db.from(table).select("*");
      if (error) throw error;
      return ((data ?? []) as never[]).map(map);
    },
  });
}

const KIND_ICON: Record<TaskNotifKind, typeof Bell> = {
  assigned: UserPlus,
  "due-soon": Clock,
  overdue: CircleAlert,
  missed: CalendarX,
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;
  const today = todayLocal();
  const yesterday = toISODateOnly(new Date(Date.now() - 86_400_000));

  const choresQ = useNotifQuery<NotifChore>(["chores"], "chores", (r) => {
    const c = r as unknown as Record<string, unknown>;
    return {
      id: c.id as string,
      title: c.title as string,
      recurrence: c.recurrence as NotifChore["recurrence"],
      days_of_week: (c.days_of_week as number[]) ?? [],
      day_of_month: c.day_of_month as number | null,
      due_time: c.due_time as string | null,
      start_date: c.start_date as string,
      end_date: c.end_date as string | null,
      active: c.active as boolean,
    };
  });
  const assignQ = useNotifQuery<NotifAssignment>(["chore_assignments"], "chore_assignments", (r) => {
    const a = r as unknown as Record<string, unknown>;
    return {
      id: a.id as string,
      chore_id: a.chore_id as string,
      user_id: a.user_id as string,
      created_at: a.created_at as string,
    };
  });
  const tasksQ = useNotifQuery<NotifTask>(["tasks"], "tasks", (r) => {
    const t = r as unknown as Record<string, unknown>;
    return {
      id: t.id as string,
      title: t.title as string,
      due_date: t.due_date as string | null,
      completed: t.completed as boolean,
    };
  });
  const compTodayQ = useQuery({
    queryKey: ["chore_completions", today],
    queryFn: async () => {
      const { data, error } = await db.from("chore_completions").select("*").eq("instance_date", today);
      if (error) throw error;
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
        chore_id: c.chore_id as string,
        instance_date: c.instance_date as string,
      })) as NotifCompletion[];
    },
  });
  const compYestQ = useQuery({
    queryKey: ["chore_completions", yesterday],
    queryFn: async () => {
      const { data, error } = await db.from("chore_completions").select("*").eq("instance_date", yesterday);
      if (error) throw error;
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
        chore_id: c.chore_id as string,
        instance_date: c.instance_date as string,
      })) as NotifCompletion[];
    },
  });

  // Watermark state (per user). Initialized from localStorage; persisted back
  // whenever generation advances it.
  const [watermark, setWm] = useState<string | null>(() =>
    userId ? getWatermark(userId) : null,
  );
  useEffect(() => {
    setWm(userId ? getWatermark(userId) : null);
  }, [userId]);

  const [read, setRead] = useState<Set<string>>(() => readIds());

  const { notifications, newWatermark } = useMemo(() => {
    return computeTaskNotifications(
      {
        userId,
        chores: choresQ.data ?? [],
        assignments: assignQ.data ?? [],
        completionsToday: compTodayQ.data ?? [],
        completionsYesterday: compYestQ.data ?? [],
        tasks: tasksQ.data ?? [],
        assignmentWatermark: watermark,
      },
      new Date(),
    );
  }, [
    userId,
    choresQ.data,
    assignQ.data,
    tasksQ.data,
    compTodayQ.data,
    compYestQ.data,
    watermark,
  ]);

  // Persist the advanced watermark (avoids re-notifying for the same
  // assignments on the next render).
  useEffect(() => {
    if (!userId) return;
    if (getWatermark(userId) !== newWatermark) {
      setWatermark(userId, newWatermark);
      setWm(newWatermark);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, newWatermark]);

  const unread = useMemo(
    () => notifications.filter((n) => !read.has(n.id)),
    [notifications, read],
  );

  const markRead = (n: TaskNotification) => {
    setRead((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      writeIds(next);
      return next;
    });
  };

  const markAllRead = () => {
    setRead((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      writeIds(next);
      return next;
    });
  };

  const openNotif = (n: TaskNotification) => {
    markRead(n);
    navigate({ to: n.to, search: n.search });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread.length > 0 ? `, ${unread.length} unread` : ""}`}
          title="Notifications"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border bg-card hover:opacity-80"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              All caught up — nothing needs your attention.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind];
                const isUnread = !read.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotif(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50",
                        isUnread && "bg-muted/30",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", SEVERITY_TONE[n.severity])} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>
                            {n.title}
                          </span>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {n.detail}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
