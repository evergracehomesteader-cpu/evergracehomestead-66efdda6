import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PawPrint, Wheat, Sprout, Receipt, AlertTriangle, Heart, Handshake } from "lucide-react";
import { format, addDays, isBefore } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Stat({ icon: Icon, label, value, to, accent }: { icon: typeof PawPrint; label: string; value: string | number; to: string; accent?: string }) {
  return (
    <Link to={to}>
      <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-display font-semibold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Dashboard() {
  const animals = useQuery({
    queryKey: ["dash-animals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("id, status").eq("status", "active");
      if (error) throw error;
      return data;
    },
  });
  const feed = useQuery({
    queryKey: ["dash-feed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_items").select("id, name, stock_qty, low_stock_threshold");
      if (error) throw error;
      return data;
    },
  });
  const bills = useQuery({
    queryKey: ["dash-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("id, name, due_date, amount_cents, paid").eq("paid", false);
      if (error) throw error;
      return data;
    },
  });
  const pregs = useQuery({
    queryKey: ["dash-preg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pregnancies")
        .select("id, expected_due, animal_id, animals!pregnancies_animal_id_fkey(name)")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });
  const garden = useQuery({
    queryKey: ["dash-garden"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garden_plots").select("id").neq("status", "harvested");
      if (error) throw error;
      return data;
    },
  });
  const barter = useQuery({
    queryKey: ["dash-barter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barter_deals")
        .select("id, title, person_name, status, due_date, trade_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lowStock = (feed.data ?? []).filter((f) => Number(f.stock_qty) <= Number(f.low_stock_threshold) && Number(f.low_stock_threshold) > 0);
  const upcomingBills = (bills.data ?? []).filter((b) => b.due_date && isBefore(new Date(b.due_date), addDays(new Date(), 14)));
  const pendingBarter = (barter.data ?? []).filter((b) => b.status === "pending");
  const upcomingBarter = pendingBarter.filter((b) => b.due_date && isBefore(new Date(b.due_date), addDays(new Date(), 14)));
  const recentBarter = (barter.data ?? []).slice(0, 5);
  const completedBarterCount = (barter.data ?? []).filter((b) => b.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Welcome home</h1>
        <p className="text-muted-foreground">Today's snapshot of your homestead.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/animals"><PawPrint className="h-4 w-4" /> Add animal</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/feed"><Wheat className="h-4 w-4" /> Buy feed</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/bills"><Receipt className="h-4 w-4" /> Add bill</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/barter"><Handshake className="h-4 w-4" /> New trade</Link></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={PawPrint} label="Active animals" value={animals.data?.length ?? "—"} to="/animals" />
        <Stat icon={Wheat} label="Feed items" value={feed.data?.length ?? "—"} to="/feed" />
        <Stat icon={Sprout} label="Garden plots" value={garden.data?.length ?? "—"} to="/garden" />
        <Stat icon={Receipt} label="Unpaid bills" value={bills.data?.length ?? "—"} to="/bills" accent="bg-accent/15 text-accent" />
        <Stat icon={Handshake} label="Pending barter" value={pendingBarter.length} to="/barter" accent="bg-warning/15 text-warning" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
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
            <h3 className="font-semibold">Active pregnancies</h3>
          </div>
          {(pregs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None tracked.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pregs.data?.map((p) => {
                const a = p.animals as { name?: string } | null;
                return (
                  <li key={p.id} className="flex justify-between">
                    <span>{a?.name ?? "—"}</span>
                    <span className="text-muted-foreground">{p.expected_due ? `due ${format(new Date(p.expected_due), "MMM d")}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Bills due soon</h3>
          </div>
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in 14 days.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingBills.map((b) => (
                <li key={b.id} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="text-muted-foreground">{b.due_date ? format(new Date(b.due_date), "MMM d") : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Handshake className="h-4 w-4 text-warning" />
            <h3 className="font-semibold">Barter due soon</h3>
          </div>
          {upcomingBarter.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending trades due soon.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingBarter.map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span className="truncate">{b.title}</span>
                  <span className="text-warning font-medium whitespace-nowrap">{b.due_date ? format(new Date(b.due_date), "MMM d") : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Handshake className="h-4 w-4 text-success" />
            <h3 className="font-semibold">Completed trades</h3>
          </div>
          <div className="text-3xl font-display font-semibold">{completedBarterCount}</div>
          <p className="text-sm text-muted-foreground">Total completed barter deals.</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Handshake className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Recent barter</h3>
          </div>
          {recentBarter.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentBarter.map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span className="truncate">{b.title}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">{b.person_name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
