import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { PawPrint } from "lucide-react";

type Node = { id: string; name: string; mother_id: string | null; father_id: string | null } | null;

async function fetchAnimal(id: string | null | undefined): Promise<Node> {
  if (!id) return null;
  const { data } = await supabase.from("animals").select("id,name,mother_id,father_id").eq("id", id).maybeSingle();
  return (data as Node) ?? null;
}

function NodeBox({ node, label }: { node: Node; label: string }) {
  return (
    <Card className="p-2 text-center min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {node ? (
        <Link to="/animals/$animalId" params={{ animalId: node.id }} className="text-sm font-medium text-primary hover:underline truncate block">
          {node.name}
        </Link>
      ) : (
        <div className="text-sm text-muted-foreground">—</div>
      )}
    </Card>
  );
}

export function LineageTree({ animalId }: { animalId: string }) {
  const { data: self } = useQuery({ queryKey: ["lineage-self", animalId], queryFn: () => fetchAnimal(animalId) });
  const { data: mom } = useQuery({ queryKey: ["lineage", self?.mother_id], enabled: !!self?.mother_id, queryFn: () => fetchAnimal(self?.mother_id) });
  const { data: dad } = useQuery({ queryKey: ["lineage", self?.father_id], enabled: !!self?.father_id, queryFn: () => fetchAnimal(self?.father_id) });
  const { data: mgm } = useQuery({ queryKey: ["lineage", mom?.mother_id], enabled: !!mom?.mother_id, queryFn: () => fetchAnimal(mom?.mother_id) });
  const { data: mgf } = useQuery({ queryKey: ["lineage", mom?.father_id], enabled: !!mom?.father_id, queryFn: () => fetchAnimal(mom?.father_id) });
  const { data: pgm } = useQuery({ queryKey: ["lineage", dad?.mother_id], enabled: !!dad?.mother_id, queryFn: () => fetchAnimal(dad?.mother_id) });
  const { data: pgf } = useQuery({ queryKey: ["lineage", dad?.father_id], enabled: !!dad?.father_id, queryFn: () => fetchAnimal(dad?.father_id) });

  const { data: offspring } = useQuery({
    queryKey: ["lineage-off", animalId],
    queryFn: async () => (await supabase.from("animals").select("id,name,sex").or(`mother_id.eq.${animalId},father_id.eq.${animalId}`)).data ?? [],
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-2">Ancestry (3 generations)</h3>
        <div className="grid grid-cols-4 gap-2">
          <NodeBox node={mgm ?? null} label="MGM" />
          <NodeBox node={mgf ?? null} label="MGF" />
          <NodeBox node={pgm ?? null} label="PGM" />
          <NodeBox node={pgf ?? null} label="PGF" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <NodeBox node={mom ?? null} label="Mother" />
          <NodeBox node={dad ?? null} label="Father" />
        </div>
        <div className="mt-2">
          <Card className="p-3 text-center bg-primary/5 border-primary/30">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">This animal</div>
            <div className="font-semibold">{self?.name ?? "…"}</div>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2">Offspring</h3>
        {(offspring ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No offspring recorded.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {offspring!.map((o) => (
              <Link key={o.id} to="/animals/$animalId" params={{ animalId: o.id }}>
                <Card className="p-2 hover:shadow-md transition-shadow flex items-center gap-2">
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm truncate">{o.name}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
