import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PawPrint, Wheat, Sprout, Receipt, AlertTriangle, Heart, Handshake, ListTodo, Bell, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format, addDays, isBefore, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { computeReminders, severityClass } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Stat({ icon: Icon, label, value, to, accent }: { icon: typeof PawPrint; label: string; value: string | number; to: string; accent?: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-display font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground truncate">{label}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function Dashboard() {
  const animals = useQuery({ queryKey: ["dash-animals"], queryFn: async () => (await supabase.from("animals").select("id,name,sex,species,status").eq("status", "active")).data ?? [] });
  const heats = useQuery({ queryKey: ["dash-heats"], queryFn: async () => (await supabase.from("heat_events").select("id,animal_id,event_date")).data ?? [] });
  const pregs = useQuery({
    queryKey: ["dash-preg"],
    queryFn: async () => (await supabase.from("pregnancies").select("id, animal_id, status, expected_due, bred_date, animals!pregnancies_animal_id_fkey(name)").eq("status", "active")).data ?? [],
  });
  const feed = useQuery({ queryKey: ["dash-feed"], queryFn: async () => (await supabase.from("feed_items").select("id, name, stock_qty, low_stock_threshold")).data ?? [] });
  const bills = useQuery({ queryKey: ["dash-bills"], queryFn: async () => (await supabase.from("bills").select("id, name, due_date, amount_cents, paid").eq("paid", false)).data ?? [] });
  const garden = useQuery({ queryKey: ["dash-garden"], queryFn: async () => (await supabase.from("garden_plots").select("*").neq("status", "harvested")).data ?? [] });
  const compost = useQuery({ queryKey: ["dash-compost"], queryFn: async () => (await supabase.from("compost_entries").select("id,entry_type,entry_date")).data ?? [] });
  const barter = useQuery({ queryKey: ["dash-barter"], queryFn: async () => (await supabase.from("barter_deals").select("id, title, person_name, status, due_date, trade_date, estimated_value_cents, created_at").order("created_at", { ascending: false })).data ?? [] });
  const tasks = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => { eq: (col: string, v: boolean) => Promise<{ data: { id: string; title: string; due_date: string | null; completed: boolean; category: string }[] }> } } };
      return (await c.from("tasks").select("id,title,due_date,completed,category").eq("completed", false)).data ?? [];
    },
  });
  const purchases = useQuery({ queryKey: ["dash-pur"], queryFn: async () => (await supabase.from("feed_purchases").select("price_cents,purchased_on")).data ?? [] });
  const income = useQuery({
    queryKey: ["dash-income"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => Promise<{ data: { amount_cents: number; entry_date: string }[] }> } };
      return (await c.from("income_entries").select("amount_cents,entry_date")).data ?? [];
    },
  });

  const reminders = computeReminders({
    animals: animals.data, heats: heats.data,
    pregnancies: pregs.data?.map((p) => ({ id: p.id, animal_id: p.animal_id, status: p.status, expected_due: p.expected_due, bred_date: p.bred_date })),
    feed: feed.data, bills: bills.data, tasks: tasks.data, garden: garden.data, compost: compost.data, barter: barter.data,
  });
  const urgent = reminders.filter((r) => r.severity === "urgent" || r.severity === "warning").slice(0, 5);

  const today = format(new Date(), "yyyy-MM-dd");
  const todaysTasks = (tasks.data ?? []).filter((t) => t.due_date === today || (t.due_date && t.due_date < today));
  const lowStock = (feed.data ?? []).filter((f) => Number(f.stock_qty) <= Number(f.low_stock_threshold) && Number(f.low_stock_threshold) > 0);
  const upcomingBirths = (pregs.data ?? []).filter((p) => p.expected_due && isBefore(new Date(p.expected_due), addDays(new Date(), 30)));
  const pendingBarter = (barter.data ?? []).filter((b) => b.status === "pending");

  // Monthly snapshot
  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());
  const inMonth = (d: string | null) => !!d && isWithinInterval(parseISO(d), { start, end });
  const monthIncome = (income.data ?? []).filter((i) => inMonth(i.entry_date)).reduce((s, i) => s + Number(i.amount_cents), 0);
  const monthExpenses = (bills.data ?? []).filter((b) => inMonth(b.due_date)).reduce((s, b) => s + Number(b.amount_cents ?? 0), 0)
    + (purchases.data ?? []).filter((p) => inMonth(p.purchased_on)).reduce((s, p) => s + Number(p.price_cents ?? 0), 0);
  const monthProfit = monthIncome - monthExpenses;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-display font-semibold">Welcome home</h1>
        <p className="text-muted-foreground">Today's snapshot of your homestead.</p>
      </div>

      {urgent.length > 0 && (
        <Card className="p-4 border-warning/50 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-semibold">Needs attention</h3>
            <Link to="/reminders" className="ml-auto text-xs text-primary hover:underline">View all</Link>
          </div>
          <ul className="space-y-2">
            {urgent.map((r) => (
              <li key={r.id}>
                <Link to={r.link.to} params={r.link.params as never} className="flex items-center gap-2 text-sm hover:bg-accent rounded p-1 -m-1">
                  <Badge className={severityClass(r.severity)}>{r.severity}</Badge>
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-muted-foreground text-xs">{r.subtitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/animals"><PawPrint className="h-4 w-4" /> Add animal</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/feed"><Wheat className="h-4 w-4" /> Buy feed</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/tasks"><ListTodo className="h-4 w-4" /> New task</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/bills"><Receipt className="h-4 w-4" /> Add bill</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/barter"><Handshake className="h-4 w-4" /> New trade</Link></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat icon={PawPrint} label="Active animals" value={animals.data?.length ?? "—"} to="/animals" />
        <Stat icon={Wheat} label="Feed items" value={feed.data?.length ?? "—"} to="/feed" />
        <Stat icon={Sprout} label="Garden plots" value={garden.data?.length ?? "—"} to="/garden" />
        <Stat icon={Receipt} label="Unpaid bills" value={bills.data?.length ?? "—"} to="/bills" accent="bg-accent/15 text-accent" />
        <Stat icon={Handshake} label="Pending barter" value={pendingBarter.length} to="/barter" accent="bg-warning/15 text-warning" />
        <Stat icon={Bell} label="Reminders" value={reminders.length} to="/reminders" accent="bg-primary/10 text-primary" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ListTodo className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Today's tasks</h3>
            <Link to="/tasks" className="ml-auto text-xs text-primary hover:underline">All</Link>
          </div>
          {todaysTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due today.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {todaysTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="truncate">{t.title}</span>
                  {t.due_date && <span className="text-muted-foreground text-xs whitespace-nowrap">{format(parseISO(t.due_date), "MMM d")}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-semibold">Low feed stock</h3>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All stocked up.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lowStock.map((f) => (
                <li key={f.id} className="flex justify-between">
                  <span>{f.name}</span>
                  <span className="text-warning font-medium">{f.stock_qty} left</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-accent" />
            <h3 className="font-semibold">Upcoming births</h3>
          </div>
          {upcomingBirths.length === 0 ? (
            <p className="text-sm text-muted-foreground">None expected soon.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingBirths.map((p) => {
                const a = p.animals as { name?: string } | null;
                return (
                  <li key={p.id} className="flex justify-between">
                    <span>{a?.name ?? "—"}</span>
                    <span className="text-muted-foreground">{p.expected_due ? format(new Date(p.expected_due), "MMM d") : "—"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{format(new Date(), "MMMM")} snapshot</h3>
          <Link to="/reports" className="ml-auto text-xs text-primary hover:underline">Full report</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3 text-success" /> Income</div>
            <div className="text-xl font-display font-semibold text-success">{fmt(monthIncome)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="h-3 w-3 text-destructive" /> Expenses</div>
            <div className="text-xl font-display font-semibold text-destructive">{fmt(monthExpenses)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Profit</div>
            <div className={`text-xl font-display font-semibold ${monthProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(monthProfit)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
