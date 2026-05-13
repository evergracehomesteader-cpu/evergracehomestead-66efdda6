import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SpeciesRow } from "@/lib/terminology";

export function useSpeciesCatalog() {
  return useQuery({
    queryKey: ["species_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("species_catalog").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as SpeciesRow[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export type BreedRow = { id: string; species_id: string; breed_name: string; is_custom: boolean };

export function useBreedsCatalog() {
  return useQuery({
    queryKey: ["breeds_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds_catalog").select("*").order("breed_name");
      if (error) throw error;
      return (data ?? []) as BreedRow[];
    },
    staleTime: 1000 * 60 * 30,
  });
}
