import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wheat, Egg, Sprout, Receipt, StickyNote, Baby, Zap } from "lucide-react";
import { FeedingDialog, type FeedingPayload, type AnimalLite } from "@/components/feed/FeedingDialog";
import type { ContainerLite, FeedItemLite, UnitLite } from "@/components/feed/PurchaseDialog";

type ActionKey = "feed" | "eggs" | "water" | "expense" | "note" | "birth";

const today = () => format(new Date(), "yyyy-MM-dd");

const ACTIONS: { key: ActionKey; label: string; icon: typeof Wheat; accent: string }[] = [
  { key: "feed", label: "Feed Animals", icon: Wheat, accent: "bg-primary/10 text-primary" },
  { key: "eggs", label: "Collect Eggs", icon: Egg, accent: "bg-success/15 text-success" },
  { key: "water", label: "Water Garden", icon: Sprout, accent: "bg-accent/15 text-accent" },
  { key: "expense", label: "Add Expense", icon: Receipt, accent: "bg-warning/15 text-warning" },
  { key: "note", label: "Animal Note", icon: StickyNote, accent: "bg-primary/10 text-primary" },
  { key: "birth", label: "Record Birth", icon: Baby, accent: "bg-accent/15 text-accent" },
];

export function QuickActions() {
  const [open, setOpen] = useState<ActionKey | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Quick actions</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => setOpen(a.key)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-3 min-h-[88px] hover:bg-accent active:scale-[0.97] transition"
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${a.accent}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-center leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      {open === "feed" ? (
        <FeedQuickDialog onClose={() => setOpen(null)} />
      ) : (
        <QuickDrawer actionKey={open} onClose={() => setOpen(null)} />
      )}
    </Card>
  );
}

function QuickDrawer({ actionKey, onClose }: { actionKey: ActionKey | null; onClose: () => void }) {
  const titles: Record<ActionKey, string> = {
    feed: "Feed Animals",
    eggs: "Collect Eggs",
    water: "Water Garden",
    expense: "Add Expense",
    note: "Animal Note",
    birth: "Record Birth",
  };
  return (
    <Drawer open={!!actionKey} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{actionKey ? titles[actionKey] : ""}</DrawerTitle>
          <DrawerDescription>Today · {format(new Date(), "EEE MMM d, h:mm a")}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 max-h-[65vh] overflow-y-auto">
          {/* feed handled by FeedQuickDialog */}
          {actionKey === "eggs" && <EggsForm onDone={onClose} />}
          {actionKey === "water" && <WaterForm onDone={onClose} />}
          {actionKey === "expense" && <ExpenseForm onDone={onClose} />}
          {actionKey === "note" && <NoteForm onDone={onClose} />}
          {actionKey === "birth" && <BirthForm onDone={onClose} />}
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function useAnimals() {
  return useQuery({
    queryKey: ["qa-animals"],
    queryFn: async () => (await supabase.from("animals").select("id,name,species,sex,status").eq("status", "active").order("name")).data ?? [],
  });
}

function useFeedItems() {
  return useQuery({
    queryKey: ["qa-feed-items"],
    queryFn: async () => (await supabase.from("feed_items").select("id,name,unit,stock_qty").order("name")).data ?? [],
  });
}

function useGardenPlots() {
  return useQuery({
    queryKey: ["qa-garden"],
    queryFn: async () => (await supabase.from("garden_plots").select("id,name,crop").neq("status", "harvested").order("name")).data ?? [],
  });
}

function SubmitRow({ saving, onSave, saveLabel = "Save" }: { saving: boolean; onSave: () => void; saveLabel?: string }) {
  return (
    <Button className="w-full h-12 text-base mt-3" onClick={onSave} disabled={saving}>
      {saving ? "Saving…" : saveLabel}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function invalidateDashboard(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries();
}

/* ---------- Feed (new dialog) ---------- */
function FeedQuickDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["qa-feed-items-full"],
    queryFn: async () => (await supabase.from("feed_items").select("id,name,store,price_cents").order("name")).data ?? [] as FeedItemLite[],
  });
  const { data: containers = [] } = useQuery({
    queryKey: ["feed-containers"],
    queryFn: async () => ((await supabase.from("feed_containers" as never).select("id,name").order("name")).data ?? []) as unknown as ContainerLite[],
  });
  const { data: units = [] } = useQuery({
    queryKey: ["feed-units"],
    queryFn: async () => ((await supabase.from("feed_units" as never).select("id,name,lbs_per_unit").order("name")).data ?? []) as unknown as UnitLite[],
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["feed-container-stock"],
    queryFn: async () => ((await supabase.from("feed_container_stock" as never).select("container_id,feed_item_id,stock_lbs")).data ?? []) as unknown as { container_id: string; feed_item_id: string; stock_lbs: number }[],
  });
  const { data: animals = [] } = useQuery({
    queryKey: ["animals-for-feeding"],
    queryFn: async () => ((await supabase.from("animals").select("id,name,species,breed,current_pen").eq("status", "active").order("name")).data ?? []) as AnimalLite[],
  });

  const addFeeding = useMutation({
    mutationFn: async (p: FeedingPayload) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("feed_logs").insert({ ...p, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Feeding logged");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <FeedingDialog
        items={items as FeedItemLite[]}
        containers={containers}
        units={units}
        stock={stock}
        animals={animals}
        onSubmit={(p) => addFeeding.mutate(p)}
        submitting={addFeeding.isPending}
      />
    </Dialog>
  );
}

/* ---------- Eggs ---------- */
function EggsForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState("");
  const [group, setGroup] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = Number(qty);
    if (!n || n <= 0) return toast.error("Enter how many eggs");
    setSaving(true);
    const { error } = await supabase.from("production_logs").insert({
      product_type: "eggs",
      quantity: n,
      unit: "ea",
      produced_on: today(),
      group_label: group || null,
    });
    setSaving(false);
    if (error) return toast.error("Could not save eggs", { description: error.message });
    toast.success(`${n} eggs collected`);
    invalidateDashboard(qc);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Field label="How many eggs?">
        <Input className="h-12 text-lg" type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 8" autoFocus />
      </Field>
      <Field label="Group / coop (optional)">
        <Input className="h-11" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Hens" />
      </Field>
      <SubmitRow saving={saving} onSave={save} saveLabel="Save eggs" />
    </div>
  );
}

/* ---------- Water Garden ---------- */
function WaterForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const plots = useGardenPlots();
  const [plotId, setPlotId] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const date = today();
    const ids = plotId === "all" ? (plots.data ?? []).map((p) => p.id) : [plotId];
    if (ids.length === 0) {
      setSaving(false);
      return toast.error("No garden plots to water");
    }
    const { error } = await supabase.from("garden_plots").update({ last_watered_on: date }).in("id", ids);
    setSaving(false);
    if (error) return toast.error("Could not save watering", { description: error.message });
    toast.success(ids.length > 1 ? `Watered ${ids.length} plots` : "Plot watered");
    invalidateDashboard(qc);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Field label="Plot">
        <Select value={plotId} onValueChange={setPlotId}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active plots</SelectItem>
            {(plots.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}{p.crop ? ` · ${p.crop}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <SubmitRow saving={saving} onSave={save} saveLabel="Mark watered" />
    </div>
  );
}

/* ---------- Expense ---------- */
function ExpenseForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter an amount");
    setSaving(true);
    const { error } = await supabase.from("bills").insert({
      name: name.trim(),
      amount_cents: Math.round(n * 100),
      category: category || null,
      due_date: today(),
      paid: true,
      paid_on: today(),
      recurring: "none",
    });
    setSaving(false);
    if (error) return toast.error("Could not save expense", { description: error.message });
    toast.success("Expense recorded");
    invalidateDashboard(qc);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Field label="What was it for?">
        <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hardware store" autoFocus />
      </Field>
      <Field label="Amount ($)">
        <Input className="h-11" type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Category (optional)">
        <Input className="h-11" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Feed, fuel, vet…" />
      </Field>
      <SubmitRow saving={saving} onSave={save} saveLabel="Save expense" />
    </div>
  );
}

/* ---------- Animal Note ---------- */
function NoteForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const animals = useAnimals();
  const [animalId, setAnimalId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!animalId) return toast.error("Pick an animal");
    if (!title.trim()) return toast.error("Add a short title");
    setSaving(true);
    const { error } = await supabase.from("animal_events").insert({
      animal_id: animalId,
      event_type: "note",
      event_date: today(),
      title: title.trim(),
      details: body ? { body } : null,
    });
    setSaving(false);
    if (error) return toast.error("Could not save note", { description: error.message });
    toast.success("Note saved");
    invalidateDashboard(qc);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Field label="Animal">
        <Select value={animalId} onValueChange={setAnimalId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Choose animal" /></SelectTrigger>
          <SelectContent>
            {(animals.data ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name} · {a.species}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Title">
        <Input className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Limping on left front" />
      </Field>
      <Field label="Details (optional)">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <SubmitRow saving={saving} onSave={save} saveLabel="Save note" />
    </div>
  );
}

/* ---------- Birth ---------- */
function BirthForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const animals = useAnimals();
  const females = (animals.data ?? []).filter((a) => a.sex === "female");
  const males = (animals.data ?? []).filter((a) => a.sex === "male");

  const [motherId, setMotherId] = useState("");
  const [fatherId, setFatherId] = useState<string>("none");
  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [unknown, setUnknown] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!motherId) return toast.error("Pick the mother");
    const m = Number(male) || 0, f = Number(female) || 0, u = Number(unknown) || 0;
    if (m + f + u === 0) return toast.error("Enter at least one offspring");
    setSaving(true);
    const { error } = await supabase.from("litters").insert({
      mother_id: motherId,
      father_id: fatherId === "none" ? null : fatherId,
      birth_date: today(),
      male_count: m,
      female_count: f,
      unknown_count: u,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error("Could not record birth", { description: error.message });
    toast.success("Birth recorded");
    invalidateDashboard(qc);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Field label="Mother">
        <Select value={motherId} onValueChange={setMotherId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Choose mother" /></SelectTrigger>
          <SelectContent>
            {females.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name} · {a.species}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Father (optional)">
        <Select value={fatherId} onValueChange={setFatherId}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unknown</SelectItem>
            {males.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name} · {a.species}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Male"><Input className="h-11" type="number" inputMode="numeric" value={male} onChange={(e) => setMale(e.target.value)} placeholder="0" /></Field>
        <Field label="Female"><Input className="h-11" type="number" inputMode="numeric" value={female} onChange={(e) => setFemale(e.target.value)} placeholder="0" /></Field>
        <Field label="Unknown"><Input className="h-11" type="number" inputMode="numeric" value={unknown} onChange={(e) => setUnknown(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Notes (optional)">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <SubmitRow saving={saving} onSave={save} saveLabel="Record birth" />
    </div>
  );
}
