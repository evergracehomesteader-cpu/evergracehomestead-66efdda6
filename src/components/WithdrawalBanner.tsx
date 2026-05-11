import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

export type HealthRecord = {
  id: string;
  product: string | null;
  withdrawal_meat_until: string | null;
  withdrawal_milk_until: string | null;
  withdrawal_eggs_until: string | null;
};

export function WithdrawalBanner({ records }: { records: HealthRecord[] }) {
  const today = new Date();
  const active: { kind: "meat" | "milk" | "eggs"; until: string; product: string | null }[] = [];
  for (const r of records) {
    (["meat", "milk", "eggs"] as const).forEach((k) => {
      const v = r[`withdrawal_${k}_until` as const];
      if (v && parseISO(v) >= today) active.push({ kind: k, until: v, product: r.product });
    });
  }
  if (active.length === 0) return null;
  return (
    <Card className="p-3 border-destructive/50 bg-destructive/5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm">Active withdrawal periods</div>
          <ul className="text-sm space-y-0.5">
            {active.map((a, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="capitalize">{a.kind}</Badge>
                <span className="text-muted-foreground">until {format(parseISO(a.until), "MMM d")} ({differenceInDays(parseISO(a.until), today) + 1}d)</span>
                {a.product && <span className="text-xs text-muted-foreground">— {a.product}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
