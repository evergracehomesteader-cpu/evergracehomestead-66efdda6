import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays, parseISO, subDays } from "date-fns";

type Log = {
  id: string; feed_item_id: string; container_id: string | null;
  total_lbs: number; quantity: number; fed_on: string;
  animal_id: string | null; target_type: string | null; target_value: string | null;
};
type Item = { id: string; name: string };
type Container = { id: string; name: string };
type Stock = { container_id: string; feed_item_id: string; stock_lbs: number };
type Animal = { id: string; name: string };

export function FeedReportsTab() {
  const { data: logs = [] } = useQuery({
    queryKey: ["feed-logs-all"],
    queryFn: async () => {
      const since = subDays(new Date(), 90).toISOString().slice(0, 10);
      const { data } = await supabase.from("feed_logs").select("*").gte("fed_on", since).order("fed_on", { ascending: false });
      return (data ?? []) as unknown as Log[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["feed-items-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_items").select("id,name");
      return (data ?? []) as Item[];
    },
  });
  const { data: containers = [] } = useQuery({
    queryKey: ["feed-containers"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_containers" as never).select("id,name");
      return (data ?? []) as unknown as Container[];
    },
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["feed-container-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_container_stock" as never).select("container_id,feed_item_id,stock_lbs");
      return (data ?? []) as unknown as Stock[];
    },
  });
  const { data: animals = [] } = useQuery({
    queryKey: ["animals-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("animals").select("id,name");
      return (data ?? []) as Animal[];
    },
  });

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "(unknown)";
  const animalName = (id: string) => animals.find((a) => a.id === id)?.name ?? "(unknown)";

  // Daily usage by item, last 30 days
  const dailyByItem = useMemo(() => {
    const m = new Map<string, Map<string, number>>(); // date -> item -> lbs
    const cutoff = subDays(new Date(), 30);
    logs.forEach((l) => {
      if (parseISO(l.fed_on) < cutoff) return;
      const day = l.fed_on;
      if (!m.has(day)) m.set(day, new Map());
      const itemMap = m.get(day)!;
      itemMap.set(l.feed_item_id, (itemMap.get(l.feed_item_id) ?? 0) + Number(l.total_lbs || l.quantity || 0));
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  // Usage per target (animal/breed/species/pen/group)
  const usageByTarget = useMemo(() => {
    const m = new Map<string, { label: string; type: string; total: number; days: Set<string> }>();
    logs.forEach((l) => {
      const type = l.target_type ?? (l.animal_id ? "animal" : "other");
      const label = type === "animal" ? animalName(l.animal_id ?? "") : (l.target_value ?? "—");
      const key = `${type}::${label}`;
      const cur = m.get(key) ?? { label, type, total: 0, days: new Set() };
      cur.total += Number(l.total_lbs || l.quantity || 0);
      cur.days.add(l.fed_on);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [logs, animals]);

  // Days remaining per container/feed = current stock ÷ avg daily use over last 14 days
  const daysRemaining = useMemo(() => {
    const cutoff = subDays(new Date(), 14);
    const usage = new Map<string, number>(); // container::item -> total lbs in window
    logs.forEach((l) => {
      if (!l.container_id) return;
      if (parseISO(l.fed_on) < cutoff) return;
      const k = `${l.container_id}::${l.feed_item_id}`;
      usage.set(k, (usage.get(k) ?? 0) + Number(l.total_lbs || l.quantity || 0));
    });
    return stock.filter((s) => s.stock_lbs > 0).map((s) => {
      const used = usage.get(`${s.container_id}::${s.feed_item_id}`) ?? 0;
      const perDay = used / 14;
      const days = perDay > 0 ? Math.floor(s.stock_lbs / perDay) : null;
      return {
        container: containers.find((c) => c.id === s.container_id)?.name ?? "—",
        item: itemName(s.feed_item_id),
        stock: Number(s.stock_lbs),
        perDay,
        days,
      };
    }).sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  }, [stock, logs, containers, items]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-lg font-semibold mb-2">Days of feed remaining</h3>
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>Container</TableHead><TableHead>Feed</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Avg/day</TableHead><TableHead className="text-right">Days left</TableHead></TableRow></TableHeader>
            <TableBody>
              {daysRemaining.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No stock yet</TableCell></TableRow>}
              {daysRemaining.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.container}</TableCell>
                  <TableCell>{r.item}</TableCell>
                  <TableCell className="text-right">{r.stock.toFixed(1)} lb</TableCell>
                  <TableCell className="text-right">{r.perDay.toFixed(2)} lb</TableCell>
                  <TableCell className={`text-right font-medium ${r.days != null && r.days < 7 ? "text-warning" : ""}`}>{r.days != null ? `${r.days}d` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold mb-2">Usage by target (last 90 days)</h3>
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Target</TableHead><TableHead className="text-right">Days fed</TableHead><TableHead className="text-right">Total lb</TableHead><TableHead className="text-right">Avg/day</TableHead></TableRow></TableHeader>
            <TableBody>
              {usageByTarget.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No feedings logged</TableCell></TableRow>}
              {usageByTarget.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right">{r.days.size}</TableCell>
                  <TableCell className="text-right">{r.total.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{(r.total / Math.max(1, r.days.size)).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold mb-2">Daily usage (last 30 days)</h3>
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Feed</TableHead><TableHead className="text-right">lb</TableHead></TableRow></TableHeader>
            <TableBody>
              {dailyByItem.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No feedings logged</TableCell></TableRow>}
              {dailyByItem.flatMap(([day, m]) =>
                Array.from(m.entries()).map(([itemId, lbs]) => (
                  <TableRow key={`${day}-${itemId}`}>
                    <TableCell>{format(parseISO(day), "MMM d")}</TableCell>
                    <TableCell>{itemName(itemId)}</TableCell>
                    <TableCell className="text-right">{lbs.toFixed(1)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
