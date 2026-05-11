import { supabase } from "@/integrations/supabase/client";

export type AnimalFinance = {
  purchaseCents: number;
  feedCents: number;
  medicalCents: number;
  breedingCents: number;
  incomeCents: number;
  productionCents: number;
  invested: number;
  earned: number;
  net: number;
  items: { label: string; cents: number; kind: "in" | "out" }[];
};

type SbAny = { from: (t: string) => { select: (s: string) => { eq: (col: string, v: string) => Promise<{ data: unknown[] | null }> } } };

export async function loadAnimalFinance(animalId: string): Promise<AnimalFinance> {
  const sb = supabase as unknown as SbAny;
  const { data: animal } = await supabase.from("animals").select("purchase_cost_cents, name").eq("id", animalId).maybeSingle();
  const purchaseCents = Number((animal as { purchase_cost_cents?: number } | null)?.purchase_cost_cents ?? 0);

  // Feed cost: feed_logs joined to feed_items (price per package_size unit)
  const { data: logsData } = await supabase
    .from("feed_logs")
    .select("quantity, feed_item_id, fed_on")
    .eq("animal_id", animalId);
  const feedItemIds = [...new Set((logsData ?? []).map((l) => l.feed_item_id).filter(Boolean) as string[])];
  let feedItems: { id: string; price_cents: number | null; package_size: number | null }[] = [];
  if (feedItemIds.length) {
    const { data } = await supabase.from("feed_items").select("id, price_cents, package_size").in("id", feedItemIds);
    feedItems = (data ?? []) as typeof feedItems;
  }
  const priceMap = new Map(feedItems.map((f) => [f.id, { price: Number(f.price_cents ?? 0), pkg: Number(f.package_size ?? 0) }]));
  const feedCents: number = (logsData ?? []).reduce<number>((s, l) => {
    const p = priceMap.get(l.feed_item_id as string);
    if (!p || !p.pkg) return s;
    return s + (Number(l.quantity) / p.pkg) * p.price;
  }, 0);

  // Medical
  const { data: hr } = await sb.from("health_records").select("cost_cents").eq("animal_id", animalId);
  const medicalCents: number = (hr ?? []).reduce<number>((s, r) => s + Number((r as { cost_cents?: number }).cost_cents ?? 0), 0);

  // Breeding (animal_id is the dam)
  const { data: pregs } = await supabase.from("pregnancies").select("breeding_cost_cents").eq("animal_id", animalId);
  const breedingCents: number = (pregs ?? []).reduce<number>((s, p) => s + Number((p as { breeding_cost_cents?: number }).breeding_cost_cents ?? 0), 0);

  // Income linked to this animal
  const { data: inc } = await sb.from("income_entries").select("amount_cents, link_type, link_id").eq("link_id", animalId);
  const incomeCents: number = (inc ?? []).filter((i) => (i as { link_type?: string }).link_type === "animal").reduce<number>((s, i) => s + Number((i as { amount_cents?: number }).amount_cents ?? 0), 0);

  // Production value attributed to this animal
  const { data: prod } = await sb.from("production_logs").select("value_cents").eq("animal_id", animalId);
  const productionCents: number = (prod ?? []).reduce<number>((s, p) => s + Number((p as { value_cents?: number }).value_cents ?? 0), 0);

  const invested = purchaseCents + Math.round(feedCents) + medicalCents + breedingCents;
  const earned = incomeCents + productionCents;
  return {
    purchaseCents, feedCents: Math.round(feedCents), medicalCents, breedingCents,
    incomeCents, productionCents, invested, earned, net: earned - invested,
    items: [
      { label: "Purchase", cents: purchaseCents, kind: "out" },
      { label: "Feed", cents: Math.round(feedCents), kind: "out" },
      { label: "Medical", cents: medicalCents, kind: "out" },
      { label: "Breeding", cents: breedingCents, kind: "out" },
      { label: "Sales", cents: incomeCents, kind: "in" },
      { label: "Production value", cents: productionCents, kind: "in" },
    ],
  };
}
