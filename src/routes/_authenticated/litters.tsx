import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Baby } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { weaningDaysFor } from "@/lib/homestead";

export const Route = createFileRoute("/_authenticated/litters")({ component: LittersPage });

type Litter = {
  id: string; mother_id: string | null; father_id: string | null;
  birth_date: string; male_count: number; female_count: number; unknown_count: number;
  notes: string | null;
};
type AnimalLite = { id: string; name: string; species: string; date_of_birth: string | null; sex: string; litter_id: string | null; status?: string; nursing_started_at?: string | null; weaning_due?: string | null };

function LittersPage() {
  const { data: litters } = useQuery({
    queryKey: ["litters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("litters").select("*").order("birth_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Litter[];
    },
  });

  const { data: animals } = useQuery({
    queryKey: ["animals-for-litters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("id,name,species,date_of_birth,sex,litter_id,status,nursing_started_at,weaning_due");
      if (error) throw error;
      return (data ?? []) as AnimalLite[];
    },
  });

  const byId = Object.fromEntries((animals ?? []).map((a) => [a.id, a]));
  const byLitter = (animals ?? []).reduce<Record<string, AnimalLite[]>>((acc, a) => {
    if (a.litter_id) (acc[a.litter_id] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Breeding &amp; Litters</h1>
        <p className="text-muted-foreground">Every litter and its offspring. Add new litters from the Animals page.</p>
      </div>

      {(litters ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Baby className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No litters yet. Use “Quick add litter” from Animals.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {litters!.map((l) => {
            const mom = l.mother_id ? byId[l.mother_id] : null;
            const dad = l.father_id ? byId[l.father_id] : null;
            const babies = byLitter[l.id] ?? [];
            return (
              <Card key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">
                      {mom?.name ?? "Unknown mom"} {dad ? `× ${dad.name}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Born {format(parseISO(l.birth_date), "MMM d, yyyy")} · {mom?.species ?? ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {l.male_count > 0 && <Badge variant="secondary">{l.male_count} boys</Badge>}
                    {l.female_count > 0 && <Badge variant="secondary">{l.female_count} girls</Badge>}
                    {l.unknown_count > 0 && <Badge variant="outline">{l.unknown_count} unknown</Badge>}
                  </div>
                </div>
                {mom && (mom.status === "nursing" || mom.nursing_started_at) && (() => {
                  const birth = parseISO(l.birth_date);
                  const sinceBirth = Math.max(0, differenceInCalendarDays(new Date(), birth));
                  const due = mom.weaning_due ? parseISO(mom.weaning_due) : null;
                  const weaningIn = due ? differenceInCalendarDays(due, new Date()) : weaningDaysFor(mom.species);
                  return (
                    <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>🍼 Nursing: {sinceBirth} day{sinceBirth === 1 ? "" : "s"} since birth</span>
                      {weaningIn !== null && (
                        <span>Weaning due {weaningIn > 0 ? `in ${weaningIn} day${weaningIn === 1 ? "" : "s"}` : weaningIn === 0 ? "today" : `${-weaningIn} day${weaningIn === -1 ? "" : "s"} overdue`}</span>
                      )}
                    </div>
                  );
                })()}
                {l.notes && <p className="text-sm text-muted-foreground mt-2">{l.notes}</p>}
                {babies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {babies.map((b) => (
                      <Link key={b.id} to="/animals/$animalId" params={{ animalId: b.id }}>
                        <Badge variant="outline" className="hover:bg-accent cursor-pointer">{b.name}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
