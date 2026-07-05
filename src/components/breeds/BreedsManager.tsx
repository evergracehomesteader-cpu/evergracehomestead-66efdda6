import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useSpeciesCatalog, useBreedsCatalog } from "@/hooks/useSpeciesCatalog";

export function BreedsManager() {
  const qc = useQueryClient();
  const { data: species = [] } = useSpeciesCatalog();
  const { data: breeds = [] } = useBreedsCatalog();
  const [speciesId, setSpeciesId] = useState<string>("");
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!speciesId || !name.trim()) throw new Error("Pick a species and enter a breed name");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("breeds_catalog").insert({
        species_id: speciesId, breed_name: name.trim(), is_custom: true, created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["breeds_catalog"] }); setName(""); toast.success("Breed added"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("breeds_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["breeds_catalog"] }); toast.success("Removed"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Breeds</h2>
        <p className="text-sm text-muted-foreground">Add or remove breeds shown when creating animals.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
        <div>
          <Label>Species</Label>
          <Select value={speciesId} onValueChange={setSpeciesId}>
            <SelectTrigger><SelectValue placeholder="Pick species" /></SelectTrigger>
            <SelectContent>{species.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Breed name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kunekune, Golden Laced Wyandotte" maxLength={100} />
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      <div className="space-y-3">
        {species.map((s) => {
          const list = breeds.filter((b) => b.species_id === s.id);
          if (list.length === 0) return null;
          return (
            <div key={s.id}>
              <div className="text-sm font-medium mb-1">{s.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((b) => (
                  <div key={b.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    <span>{b.breed_name}</span>
                    <ConfirmDelete
                      trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                      title={`Remove ${b.breed_name}?`}
                      description="Animals already tagged with this breed keep their label."
                      onConfirm={() => del.mutate(b.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
