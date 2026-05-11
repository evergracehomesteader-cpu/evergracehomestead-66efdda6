import { supabase } from "@/integrations/supabase/client";

export type AncestorMap = Map<string, { name: string; depth: number; via: "mother" | "father" | "self" }>;

/** Walk up to `depth` generations of ancestors for an animal id. Returns map keyed by ancestor id. */
export async function loadAncestors(animalId: string, depth = 3): Promise<AncestorMap> {
  const map: AncestorMap = new Map();
  const queue: { id: string; d: number; via: "mother" | "father" | "self" }[] = [{ id: animalId, d: 0, via: "self" }];
  const seen = new Set<string>();
  while (queue.length) {
    const { id, d, via } = queue.shift()!;
    if (seen.has(id) || d > depth) continue;
    seen.add(id);
    const { data } = await supabase.from("animals").select("id, name, mother_id, father_id").eq("id", id).maybeSingle();
    if (!data) continue;
    if (d > 0) map.set(data.id, { name: data.name, depth: d, via });
    if (data.mother_id) queue.push({ id: data.mother_id, d: d + 1, via: d === 0 ? "mother" : via });
    if (data.father_id) queue.push({ id: data.father_id, d: d + 1, via: d === 0 ? "father" : via });
  }
  return map;
}

/** Return common ancestors between two animals, or empty array if none within depth. */
export async function findCommonAncestors(damId: string, sireId: string, depth = 3) {
  const [a, b] = await Promise.all([loadAncestors(damId, depth), loadAncestors(sireId, depth)]);
  // Direct relation: one is ancestor of the other
  const direct: { id: string; name: string; relation: string }[] = [];
  if (a.has(sireId)) direct.push({ id: sireId, name: a.get(sireId)!.name, relation: `direct ancestor (${a.get(sireId)!.depth} gen)` });
  if (b.has(damId)) direct.push({ id: damId, name: b.get(damId)!.name, relation: `direct descendant` });
  const common: { id: string; name: string; relation: string }[] = [...direct];
  for (const [id, v] of a) {
    if (b.has(id)) {
      const w = b.get(id)!;
      common.push({ id, name: v.name, relation: `shared ancestor (${v.depth + w.depth} gen apart)` });
    }
  }
  return common;
}
