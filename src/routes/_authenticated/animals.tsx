import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, PawPrint, ImagePlus, Baby, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { statusBadgeClass } from "@/lib/homestead";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { cn } from "@/lib/utils";
import { validateImageFile } from "@/lib/photo-storage";
import { SignedImg } from "@/components/SignedImg";
import {
  ANIMAL_STATUS_OPTIONS,
  BREED_TYPE_OPTIONS,
  INTACT_MALE_OPTIONS,
  computeLifeStage,
  displayTerm,
  isBreedingAge,
  type SpeciesRow,
} from "@/lib/terminology";
import { useSpeciesCatalog, useBreedsCatalog, type BreedRow } from "@/hooks/useSpeciesCatalog";

export const Route = createFileRoute("/_authenticated/animals")({ component: AnimalsPage });

type Animal = {
  id: string; name: string; species: string; breed: string | null;
  breed_type: string; secondary_breed: string | null; breed_percentage: string | null; breed_notes: string | null;
  sex: "female" | "male" | "unknown"; date_of_birth: string | null; tag: string | null;
  status: string; notes: string | null; medical_notes: string | null;
  temperament_tags: string[]; photo_url: string | null;
  front_photo_url: string | null; side_photo_url: string | null; additional_photo_urls: string[];
  auto_marking_description: string | null; user_edited_description: string | null;
  life_stage: string | null; manual_life_stage_override: boolean;
  is_intact_male: string; male_reproductive_status: string; castration_date: string | null;
  ownership: string; temporary_record: boolean; litter_id: string | null;
  mother_id: string | null; father_id: string | null;
  purchase_cost_cents?: number | null; purchase_date?: string | null;
  expected_sale_price_cents?: number | null;
  sale_price_cents?: number | null; sale_date?: string | null;
};

function AnimalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [litterOpen, setLitterOpen] = useState(false);
  const [editing, setEditing] = useState<Animal | null>(null);

  const { data: species = [] } = useSpeciesCatalog();
  const { data: breeds = [] } = useBreedsCatalog();
  const speciesByName = useMemo(() => Object.fromEntries(species.map((s) => [s.name.toLowerCase(), s])), [species]);

  const { data: animals } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("*").order("name");
      if (error) throw error;
      return data as Animal[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Animal> & { id?: string }) => {
      // Duplicate check (same name + species + dob)
      const list = animals ?? [];
      const dup = list.find((a) =>
        a.id !== payload.id &&
        a.name.trim().toLowerCase() === (payload.name ?? "").trim().toLowerCase() &&
        a.species.trim().toLowerCase() === (payload.species ?? "").trim().toLowerCase() &&
        (a.date_of_birth ?? "") === (payload.date_of_birth ?? "")
      );
      if (dup) throw new Error("An animal with the same name, species, and birthdate already exists.");

      const { data: u } = await supabase.auth.getUser();
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("animals").update(rest as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("animals").insert({ ...payload, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["animals"] });
      setOpen(false); setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["animals"] }); toast.success("Animal deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const grouped = (animals ?? []).reduce<Record<string, Animal[]>>((acc, a) => {
    (acc[a.species] ||= []).push(a); return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Animals</h1>
          <p className="text-muted-foreground">Heats, pregnancies, lineage and weight.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={litterOpen} onOpenChange={setLitterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg"><Baby className="h-4 w-4" /> Quick add litter</Button>
            </DialogTrigger>
            <QuickLitterForm
              animals={animals ?? []}
              speciesByName={speciesByName}
              onDone={() => { setLitterOpen(false); qc.invalidateQueries({ queryKey: ["animals"] }); }}
            />
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4" /> Add animal</Button>
            </DialogTrigger>
            <AnimalForm
              animals={animals ?? []}
              species={species}
              speciesByName={speciesByName}
              breeds={breeds}
              onSubmit={(p) => save.mutate(p)}
              submitting={save.isPending}
            />
          </Dialog>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="p-12 text-center">
          <PawPrint className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No animals yet. Add your first one to start tracking.</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([speciesName, list]) => {
          const sp = speciesByName[speciesName.toLowerCase()];
          return (
            <div key={speciesName}>
              <h2 className="font-display text-xl font-semibold capitalize mb-3">{speciesName}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((a) => {
                  const stage = (a.manual_life_stage_override && a.life_stage)
                    ? (a.life_stage as "baby" | "juvenile" | "adult" | "unknown")
                    : computeLifeStage(sp, a.date_of_birth);
                  const lifeLabel = displayTerm(sp, stage, a.sex);
                  const breedDisplay = a.breed_type === "cross" && a.secondary_breed
                    ? `${a.breed ?? "?"} × ${a.secondary_breed}`
                    : a.breed_type === "unknown" ? "Unknown breed" : (a.breed ?? "—");
                  const front = a.front_photo_url ?? a.photo_url;
                  return (
                    <Card key={a.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow h-full flex flex-col sm:flex-row gap-3 items-start">
                      <Link to="/animals/$animalId" params={{ animalId: a.id }} className="flex gap-3 items-start flex-1 min-w-0">
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {front ? (
                            <img src={front} alt={a.name} className="h-16 w-16 rounded-md object-cover" />
                          ) : (
                            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                              <PawPrint className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          {a.side_photo_url && (
                            <img src={a.side_photo_url} alt="" className="h-10 w-16 rounded-md object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">
                                {a.name} <span className="text-muted-foreground font-normal">• {a.sex}</span>
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {speciesName} • {breedDisplay} • {lifeLabel}
                              </div>
                            </div>
                            <Badge className={cn("hidden sm:inline-flex", statusBadgeClass(a.status))}>{a.status.replace(/_/g, " ")}</Badge>
                          </div>
                          {a.status === "pending_sale" && (a.expected_sale_price_cents ?? 0) > 0 && (
                            <div className="text-xs text-success mt-1">Expected: ${((a.expected_sale_price_cents ?? 0) / 100).toFixed(2)}</div>
                          )}
                          {(a.user_edited_description ?? a.auto_marking_description) && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {a.user_edited_description ?? a.auto_marking_description}
                            </div>
                          )}
                          {a.tag && <div className="text-xs text-muted-foreground mt-1">Tag: {a.tag}</div>}
                        </div>
                      </Link>
                      {/* Desktop actions */}
                      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={statusBadgeClass(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(a); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <ConfirmDelete
                            trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>}
                            title={`Delete ${a.name}?`}
                            description="This permanently removes the animal record. Linked litters keep their reference, but heat/pregnancy/weight/health entries on this animal will be orphaned."
                            onConfirm={() => del.mutate(a.id)}
                          />
                        </div>
                      </div>
                      {/* Mobile action bar */}
                      <div className="flex sm:hidden items-center justify-between gap-2 w-full pt-2 border-t border-border/50">
                        <Badge className={statusBadgeClass(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setEditing(a); }}>
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <ConfirmDelete
                            trigger={<Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>}
                            title={`Delete ${a.name}?`}
                            description="This permanently removes the animal record. Linked litters keep their reference, but heat/pregnancy/weight/health entries on this animal will be orphaned."
                            onConfirm={() => del.mutate(a.id)}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <AnimalForm
            initial={editing}
            animals={animals ?? []}
            species={species}
            speciesByName={speciesByName}
            breeds={breeds}
            onSubmit={(p) => save.mutate({ ...p, id: editing.id })}
            submitting={save.isPending}
          />
        </Dialog>
      )}
    </div>
  );
}

// ---------- Add/Edit Animal Form ----------

function AnimalForm({
  initial, animals, species, speciesByName, breeds, onSubmit, submitting,
}: {
  initial?: Animal;
  animals: Animal[]; species: SpeciesRow[]; speciesByName: Record<string, SpeciesRow>;
  breeds: BreedRow[];
  onSubmit: (p: Partial<Animal>) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<Partial<Animal>>(
    initial ?? {
      name: "", species: "", sex: "unknown", status: "active",
      breed_type: "purebred", is_intact_male: "unknown", male_reproductive_status: "unknown",
      ownership: "owned", temperament_tags: [], additional_photo_urls: [],
      expected_sale_price_cents: 0,
    },
  );
  const [tagsText, setTagsText] = useState((initial?.temperament_tags ?? []).join(", "));
  const [uploading, setUploading] = useState<null | "front" | "side">(null);

  const set = <K extends keyof Animal>(k: K, v: Animal[K] | null) => setForm((f) => ({ ...f, [k]: v }));

  const selectedSpecies = species.find((s) => s.name.toLowerCase() === (form.species ?? "").toLowerCase());
  const breedOptions = selectedSpecies ? breeds.filter((b) => b.species_id === selectedSpecies.id) : [];
  const showCross = form.breed_type === "cross";

  // Only show breeding-age animals as candidate parents
  const breedingParents = (sex: "male" | "female") => animals.filter((a) => {
    if (a.id === initial?.id) return false; // can't be own parent
    if (a.sex !== sex) return false;
    const sp = speciesByName[a.species.toLowerCase()];
    if (!a.date_of_birth) return true; // unknown age — allow
    return isBreedingAge(sp, sex, a.date_of_birth);
  });
  const moms = breedingParents("female");
  const dads = breedingParents("male");

  const upload = async (file: File, slot: "front" | "side") => {
    const invalid = validateImageFile(file);
    if (invalid) { toast.error(invalid); return; }
    setUploading(slot);
    try {
      const ext = (file.type.split("/")[1] ?? "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("animal-photos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      if (slot === "front") set("front_photo_url", path);
      else set("side_photo_url", path);
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(null); }
  };

  // Species list with friendly fallback for "Other"
  const speciesList = useMemo(() => {
    const names = species.map((s) => s.name);
    return [...names, "Other"];
  }, [species]);
  const [otherSpecies, setOtherSpecies] = useState(
    initial && !species.find((s) => s.name.toLowerCase() === initial.species.toLowerCase()) ? initial.species : "",
  );
  const speciesValue = otherSpecies ? "Other" : (form.species ?? "");

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit animal" : "Add animal"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const finalSpecies = otherSpecies ? otherSpecies.trim() : form.species;
          if (!form.name || !finalSpecies) { toast.error("Name and species required"); return; }
          onSubmit({
            ...form,
            species: finalSpecies,
            temperament_tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
          });
        }}
        className="space-y-3"
      >
        {/* Photos */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoSlot label="Front photo" url={form.front_photo_url ?? null} uploading={uploading === "front"} onPick={(f) => upload(f, "front")} />
          <PhotoSlot label="Side photo" url={form.side_photo_url ?? null} uploading={uploading === "side"} onPick={(f) => upload(f, "side")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required maxLength={100} /></div>
          <div>
            <Label>Species *</Label>
            <Select
              value={speciesValue}
              onValueChange={(v) => {
                if (v === "Other") { setOtherSpecies(otherSpecies || "Other"); set("species", ""); }
                else { setOtherSpecies(""); set("species", v); set("breed", null); set("secondary_breed", null); }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Pick species" /></SelectTrigger>
              <SelectContent>
                {speciesList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {otherSpecies !== "" && (
              <Input className="mt-1" placeholder="Type species name" value={otherSpecies} onChange={(e) => setOtherSpecies(e.target.value)} />
            )}
          </div>

          <div>
            <Label>Breed type</Label>
            <Select value={form.breed_type ?? "purebred"} onValueChange={(v) => set("breed_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BREED_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Breed</Label>
            {breedOptions.length > 0 ? (
              <Select value={form.breed ?? ""} onValueChange={(v) => set("breed", v)}>
                <SelectTrigger><SelectValue placeholder="Pick or type custom below" /></SelectTrigger>
                <SelectContent>
                  {breedOptions.map((b) => <SelectItem key={b.id} value={b.breed_name}>{b.breed_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.breed ?? ""} onChange={(e) => set("breed", e.target.value || null)} placeholder="Pick species first or type custom" />
            )}
            <Input className="mt-1" placeholder="…or type a custom breed" value={form.breed ?? ""} onChange={(e) => set("breed", e.target.value || null)} />
          </div>

          {showCross && (
            <>
              <div>
                <Label>Secondary breed</Label>
                {breedOptions.length > 0 ? (
                  <Select value={form.secondary_breed ?? ""} onValueChange={(v) => set("secondary_breed", v)}>
                    <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                    <SelectContent>
                      {breedOptions.map((b) => <SelectItem key={b.id} value={b.breed_name}>{b.breed_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.secondary_breed ?? ""} onChange={(e) => set("secondary_breed", e.target.value || null)} />
                )}
              </div>
              <div>
                <Label>Breed % (e.g. 50/50)</Label>
                <Input value={form.breed_percentage ?? ""} onChange={(e) => set("breed_percentage", e.target.value || null)} />
              </div>
              <div className="col-span-2">
                <Label>Breed notes</Label>
                <Input value={form.breed_notes ?? ""} onChange={(e) => set("breed_notes", e.target.value || null)} />
              </div>
            </>
          )}

          <div>
            <Label>Sex</Label>
            <Select value={form.sex} onValueChange={(v) => set("sex", v as Animal["sex"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value || null)} /></div>

          {form.sex === "male" && (
            <>
              <div className="col-span-2">
                <Label>Does he have testicles?</Label>
                <Select value={form.is_intact_male ?? "unknown"} onValueChange={(v) => set("is_intact_male", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTACT_MALE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.is_intact_male === "no" && (
                <div className="col-span-2"><Label>Castration date</Label><Input type="date" value={form.castration_date ?? ""} onChange={(e) => set("castration_date", e.target.value || null)} /></div>
              )}
            </>
          )}

          <div><Label>Tag / ID</Label><Input value={form.tag ?? ""} onChange={(e) => set("tag", e.target.value || null)} maxLength={50} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANIMAL_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.status === "pending_sale" && (
            <div className="col-span-2">
              <Label>Expected sale price ($)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={form.expected_sale_price_cents ? (form.expected_sale_price_cents / 100).toString() : ""}
                onChange={(e) => set("expected_sale_price_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : 0)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">Adds to projected income on Bills &amp; Income.</p>
            </div>
          )}

          {form.status === "sold" && (
            <>
              <div>
                <Label>Final sale price ($)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.sale_price_cents ? (form.sale_price_cents / 100).toString() : ""}
                  onChange={(e) => set("sale_price_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : 0)}
                />
              </div>
              <div><Label>Sale date</Label><Input type="date" value={form.sale_date ?? ""} onChange={(e) => set("sale_date", e.target.value || null)} /></div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mom</Label>
            <Select value={form.mother_id ?? "none"} onValueChange={(v) => set("mother_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {moms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} ({f.species})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Only breeding-age females shown.</p>
          </div>
          <div>
            <Label>Dad</Label>
            <Select value={form.father_id ?? "none"} onValueChange={(v) => set("father_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {dads.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.species})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Only breeding-age males shown.</p>
          </div>
        </div>

        <div><Label>Marking description (coat color, markings, distinguishing features)</Label>
          <Textarea value={form.user_edited_description ?? ""} onChange={(e) => set("user_edited_description", e.target.value || null)} maxLength={2000} placeholder="Black with white star on forehead, white socks on hind legs…" />
        </div>
        <div><Label>Temperament tags (comma separated)</Label><Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="friendly, skittish, leader" /></div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Purchase cost ($)</Label><Input type="number" step="0.01" value={form.purchase_cost_cents ? (form.purchase_cost_cents / 100).toString() : ""} onChange={(e) => set("purchase_cost_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : 0)} /></div>
          <div><Label>Purchase date</Label><Input type="date" value={form.purchase_date ?? ""} onChange={(e) => set("purchase_date", e.target.value || null)} /></div>
        </div>

        <div><Label>Medical notes</Label><Textarea value={form.medical_notes ?? ""} onChange={(e) => set("medical_notes", e.target.value || null)} maxLength={2000} /></div>
        <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} maxLength={2000} /></div>

        <DialogFooter><Button type="submit" disabled={submitting || !!uploading}>{submitting ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function PhotoSlot({ label, url, uploading, onPick }: { label: string; url: string | null; uploading: boolean; onPick: (f: File) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        {url ? <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" /> : (
          <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center"><PawPrint className="h-6 w-6 text-muted-foreground" /></div>
        )}
        <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border cursor-pointer hover:bg-accent text-xs">
          <ImagePlus className="h-3 w-3" /> {uploading ? "…" : url ? "Change" : "Add"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}

// ---------- Quick Add Litter ----------

function QuickLitterForm({ animals, speciesByName, onDone }: { animals: Animal[]; speciesByName: Record<string, SpeciesRow>; onDone: () => void }) {
  const moms = animals.filter((a) => {
    if (a.sex !== "female") return false;
    const sp = speciesByName[a.species.toLowerCase()];
    if (!a.date_of_birth) return true;
    return isBreedingAge(sp, "female", a.date_of_birth);
  });
  const dads = animals.filter((a) => {
    if (a.sex !== "male") return false;
    const sp = speciesByName[a.species.toLowerCase()];
    if (!a.date_of_birth) return true;
    return isBreedingAge(sp, "male", a.date_of_birth);
  });
  const [motherId, setMotherId] = useState<string>("");
  const [fatherId, setFatherId] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [maleCount, setMaleCount] = useState<number>(0);
  const [femaleCount, setFemaleCount] = useState<number>(0);
  const [unknownCount, setUnknownCount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motherId) { toast.error("Pick a mom"); return; }
    const mother = animals.find((a) => a.id === motherId);
    if (!mother) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const { data: litter, error: lErr } = await supabase
        .from("litters")
        .insert({ mother_id: motherId, father_id: fatherId || null, birth_date: birthDate, male_count: maleCount, female_count: femaleCount, unknown_count: unknownCount, notes: notes || null, created_by: userId })
        .select()
        .single();
      if (lErr) throw lErr;

      const inserts: Array<Record<string, unknown>> = [];
      const make = (sex: "male" | "female" | "unknown", label: string, idx: number) => ({
        name: `${mother.name}'s ${label} ${idx}`,
        species: mother.species,
        breed: mother.breed,
        breed_type: mother.breed_type,
        sex,
        date_of_birth: birthDate,
        mother_id: motherId,
        father_id: fatherId || null,
        status: "active",
        temporary_record: true,
        litter_id: (litter as { id: string }).id,
        created_by: userId,
      });
      for (let i = 1; i <= maleCount; i++) inserts.push(make("male", "Boy", i));
      for (let i = 1; i <= femaleCount; i++) inserts.push(make("female", "Girl", i));
      for (let i = 1; i <= unknownCount; i++) inserts.push(make("unknown", "Baby", i));

      if (inserts.length > 0) {
        const { error: aErr } = await supabase.from("animals").insert(inserts as never);
        if (aErr) throw aErr;
      }
      toast.success(`Litter saved (${inserts.length} babies)`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Quick add litter</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Mom *</Label>
          <Select value={motherId} onValueChange={setMotherId}>
            <SelectTrigger><SelectValue placeholder="Pick mom" /></SelectTrigger>
            <SelectContent>
              {moms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} ({f.species})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Dad</Label>
          <Select value={fatherId || "none"} onValueChange={(v) => setFatherId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {dads.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.species})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Birth date</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Boys</Label><Input type="number" min={0} value={maleCount} onChange={(e) => setMaleCount(Number(e.target.value) || 0)} /></div>
          <div><Label>Girls</Label><Input type="number" min={0} value={femaleCount} onChange={(e) => setFemaleCount(Number(e.target.value) || 0)} /></div>
          <div><Label>Unknown</Label><Input type="number" min={0} value={unknownCount} onChange={(e) => setUnknownCount(Number(e.target.value) || 0)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save litter"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
