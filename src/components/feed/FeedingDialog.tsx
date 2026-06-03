import { useMemo, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ContainerLite, FeedItemLite, UnitLite } from "./PurchaseDialog";

export type AnimalLite = { id: string; name: string; species: string; breed: string | null; current_pen: string | null };

export type FeedingPayload = {
  feed_item_id: string;
  container_id: string | null;
  unit_id: string | null;
  unit_qty: number | null;
  total_lbs: number;
  quantity: number;       // legacy
  fed_on: string;
  notes: string | null;
  animal_id: string | null;
  target_type: "animal" | "breed" | "species" | "pen" | "group";
  target_value: string | null;
};

type StockRow = { container_id: string; feed_item_id: string; stock_lbs: number };

export function FeedingDialog({
  items, containers, units, stock, animals, onSubmit, submitting,
}: {
  items: FeedItemLite[];
  containers: ContainerLite[];
  units: UnitLite[];
  stock: StockRow[];
  animals: AnimalLite[];
  onSubmit: (p: FeedingPayload) => void;
  submitting: boolean;
}) {
  const [feedId, setFeedId] = useState<string>(items[0]?.id ?? "");
  // For the picked feed, list containers that currently hold it (or any container if none)
  const containersForFeed = useMemo(() => {
    const ids = new Set(stock.filter((s) => s.feed_item_id === feedId && s.stock_lbs > 0).map((s) => s.container_id));
    const filtered = containers.filter((c) => ids.has(c.id));
    return filtered.length ? filtered : containers;
  }, [stock, feedId, containers]);
  const [containerId, setContainerId] = useState<string>(containersForFeed[0]?.id ?? "");

  const [unitMode, setUnitMode] = useState<"lbs" | "unit">("unit");
  const [unitId, setUnitId] = useState<string>(units[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [targetType, setTargetType] = useState<FeedingPayload["target_type"]>("animal");
  const [animalId, setAnimalId] = useState<string>("");
  const [targetValue, setTargetValue] = useState("");

  const speciesList = useMemo(() => Array.from(new Set(animals.map((a) => a.species))).sort(), [animals]);
  const breedList = useMemo(() => Array.from(new Set(animals.map((a) => a.breed).filter(Boolean) as string[])).sort(), [animals]);
  const penList = useMemo(() => Array.from(new Set(animals.map((a) => a.current_pen).filter(Boolean) as string[])).sort(), [animals]);

  const totalLbs = useMemo(() => {
    const n = Number(qty || 0);
    if (unitMode === "lbs") return n;
    const u = units.find((x) => x.id === unitId);
    return n * (u?.lbs_per_unit ?? 0);
  }, [qty, unitMode, unitId, units]);

  const currentStock = useMemo(() => stock.find((s) => s.container_id === containerId && s.feed_item_id === feedId)?.stock_lbs ?? 0, [stock, containerId, feedId]);

  const submit = () => {
    if (!feedId) { toast.error("Pick a feed"); return; }
    if (!containerId) { toast.error("Pick a container"); return; }
    if (totalLbs <= 0) { toast.error("Enter a quantity"); return; }
    if (targetType === "animal" && !animalId) { toast.error("Pick an animal"); return; }
    if (targetType !== "animal" && !targetValue) { toast.error(`Pick a ${targetType}`); return; }
    onSubmit({
      feed_item_id: feedId,
      container_id: containerId,
      unit_id: unitMode === "unit" ? unitId : null,
      unit_qty: unitMode === "unit" ? Number(qty) : null,
      total_lbs: totalLbs,
      quantity: totalLbs,
      fed_on: date,
      notes: notes || null,
      animal_id: targetType === "animal" ? animalId : null,
      target_type: targetType,
      target_value: targetType === "animal" ? null : targetValue,
    });
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Log feeding</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Feed *</Label>
            <Select value={feedId} onValueChange={setFeedId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>From container *</Label>
            <Select value={containerId} onValueChange={setContainerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{containersForFeed.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">In stock: {currentStock.toFixed(1)} lb</p>
          </div>
          <div><Label>Amount</Label><Input type="number" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div>
            <Label>Unit</Label>
            <Select value={unitMode === "lbs" ? "__lbs__" : unitId} onValueChange={(v) => {
              if (v === "__lbs__") setUnitMode("lbs");
              else { setUnitMode("unit"); setUnitId(v); }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__lbs__">Pounds</SelectItem>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.lbs_per_unit} lb)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Quick pick</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {([
                { label: "¼ bucket", qty: "0.25", match: /^bucket$|^full bucket$/i },
                { label: "½ bucket", qty: "0.5", match: /^bucket$|^full bucket$/i },
                { label: "1 bucket", qty: "1", match: /^bucket$|^full bucket$/i },
                { label: "2 buckets", qty: "2", match: /^bucket$|^full bucket$/i },
              ]).map((b) => (
                <Button key={b.label} type="button" size="sm" variant="outline" onClick={() => {
                  const u = units.find((x) => b.match.test(x.name));
                  if (!u) { toast.error('Add a "Bucket" unit in the Units tab first'); return; }
                  setUnitMode("unit"); setUnitId(u.id); setQty(b.qty);
                }}>{b.label}</Button>
              ))}
            </div>
          </div>
          <div className="col-span-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        <div className="rounded-md border p-3 text-sm flex justify-between">
          <span className="text-muted-foreground">Total fed:</span>
          <span className="font-semibold">{totalLbs.toFixed(2)} lb</span>
        </div>

        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <Label>Fed to *</Label>
          <Select value={targetType} onValueChange={(v) => setTargetType(v as FeedingPayload["target_type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="animal">Individual animal</SelectItem>
              <SelectItem value="breed">Breed</SelectItem>
              <SelectItem value="species">Species</SelectItem>
              <SelectItem value="pen">Pen</SelectItem>
              <SelectItem value="group">Custom group</SelectItem>
            </SelectContent>
          </Select>

          {targetType === "animal" && (
            <Select value={animalId} onValueChange={setAnimalId}>
              <SelectTrigger><SelectValue placeholder="Pick animal" /></SelectTrigger>
              <SelectContent>{animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.species})</SelectItem>)}</SelectContent>
            </Select>
          )}
          {targetType === "breed" && (
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger><SelectValue placeholder="Pick breed" /></SelectTrigger>
              <SelectContent>{breedList.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {targetType === "species" && (
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger><SelectValue placeholder="Pick species" /></SelectTrigger>
              <SelectContent>{speciesList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {targetType === "pen" && (
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger><SelectValue placeholder="Pick pen" /></SelectTrigger>
              <SelectContent>{penList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {targetType === "group" && (
            <Input placeholder="Group label (e.g., Layers, Weaners)" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} maxLength={100} />
          )}
        </div>

        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>

        <DialogFooter><Button onClick={submit} disabled={submitting}>Log feeding</Button></DialogFooter>
      </div>
    </DialogContent>
  );
}
