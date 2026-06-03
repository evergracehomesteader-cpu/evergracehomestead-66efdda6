import { useMemo, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type FeedItemLite = { id: string; name: string; store: string | null; price_cents: number | null };
export type ContainerLite = { id: string; name: string };
export type UnitLite = { id: string; name: string; lbs_per_unit: number };

export type PurchasePayload = {
  feed_item_id: string;
  container_id: string | null;
  store: string | null;
  purchased_on: string;
  notes: string | null;
  unit_type: "bag" | "lbs" | "custom_unit";
  bag_size_lbs: number | null;
  bag_count: number | null;
  custom_unit_id: string | null;
  custom_unit_qty: number | null;
  total_lbs: number;
  price_cents: number;          // total cost
  cost_per_bag_cents: number | null;
  quantity: number;             // legacy field — set to total_lbs
};

export function PurchaseDialog({
  item, containers, units, onSubmit, submitting,
}: {
  item: FeedItemLite;
  containers: ContainerLite[];
  units: UnitLite[];
  onSubmit: (p: PurchasePayload) => void;
  submitting: boolean;
}) {
  const [mode, setMode] = useState<"bag" | "lbs" | "custom_unit">("bag");
  const [containerId, setContainerId] = useState<string>(containers[0]?.id ?? "");
  const [store, setStore] = useState(item.store ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // bag mode
  const [bagSize, setBagSize] = useState("50");
  const [bagCount, setBagCount] = useState("1");
  const [costPerBag, setCostPerBag] = useState(((item.price_cents ?? 0) / 100).toFixed(2));

  // lbs mode
  const [lbs, setLbs] = useState("50");
  const [totalCostLbs, setTotalCostLbs] = useState("");

  // custom mode
  const [unitId, setUnitId] = useState<string>(units[0]?.id ?? "");
  const [unitQty, setUnitQty] = useState("1");
  const [totalCostCustom, setTotalCostCustom] = useState("");

  const computed = useMemo(() => {
    if (mode === "bag") {
      const lbsTotal = Number(bagSize || 0) * Number(bagCount || 0);
      const cost = Math.round(Number(costPerBag || 0) * 100) * Number(bagCount || 0);
      return { total_lbs: lbsTotal, total_cents: cost, per_bag_cents: Math.round(Number(costPerBag || 0) * 100) };
    }
    if (mode === "lbs") {
      return { total_lbs: Number(lbs || 0), total_cents: Math.round(Number(totalCostLbs || 0) * 100), per_bag_cents: null };
    }
    const u = units.find((x) => x.id === unitId);
    return {
      total_lbs: (u?.lbs_per_unit ?? 0) * Number(unitQty || 0),
      total_cents: Math.round(Number(totalCostCustom || 0) * 100),
      per_bag_cents: null,
    };
  }, [mode, bagSize, bagCount, costPerBag, lbs, totalCostLbs, unitId, unitQty, totalCostCustom, units]);

  const submit = () => {
    if (!containerId) { toast.error("Pick a storage container"); return; }
    if (!computed.total_lbs || computed.total_lbs <= 0) { toast.error("Enter a quantity"); return; }
    onSubmit({
      feed_item_id: item.id,
      container_id: containerId,
      store: store || null,
      purchased_on: date,
      notes: notes || null,
      unit_type: mode,
      bag_size_lbs: mode === "bag" ? Number(bagSize) : null,
      bag_count: mode === "bag" ? Number(bagCount) : null,
      custom_unit_id: mode === "custom_unit" ? unitId : null,
      custom_unit_qty: mode === "custom_unit" ? Number(unitQty) : null,
      total_lbs: computed.total_lbs,
      price_cents: computed.total_cents,
      cost_per_bag_cents: computed.per_bag_cents,
      quantity: computed.total_lbs,
    });
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Log purchase: {item.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Container *</Label>
            <Select value={containerId} onValueChange={setContainerId}>
              <SelectTrigger><SelectValue placeholder="Select container" /></SelectTrigger>
              <SelectContent>
                {containers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Store</Label><Input value={store} onChange={(e) => setStore(e.target.value)} maxLength={100} /></div>
          <div>
            <Label>Unit mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bag">Bags</SelectItem>
                <SelectItem value="lbs">Pounds</SelectItem>
                <SelectItem value="custom_unit">Custom unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "bag" && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/40">
            <div><Label>Bag size (lbs)</Label><Input type="number" step="0.1" value={bagSize} onChange={(e) => setBagSize(e.target.value)} /></div>
            <div><Label># of bags</Label><Input type="number" step="1" value={bagCount} onChange={(e) => setBagCount(e.target.value)} /></div>
            <div><Label>Cost / bag ($)</Label><Input type="number" step="0.01" value={costPerBag} onChange={(e) => setCostPerBag(e.target.value)} /></div>
          </div>
        )}
        {mode === "lbs" && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/40">
            <div><Label>Pounds</Label><Input type="number" step="0.1" value={lbs} onChange={(e) => setLbs(e.target.value)} /></div>
            <div><Label>Total cost ($)</Label><Input type="number" step="0.01" value={totalCostLbs} onChange={(e) => setTotalCostLbs(e.target.value)} /></div>
          </div>
        )}
        {mode === "custom_unit" && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/40">
            <div>
              <Label>Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.lbs_per_unit} lb)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantity</Label><Input type="number" step="0.1" value={unitQty} onChange={(e) => setUnitQty(e.target.value)} /></div>
            <div><Label>Total cost ($)</Label><Input type="number" step="0.01" value={totalCostCustom} onChange={(e) => setTotalCostCustom(e.target.value)} /></div>
          </div>
        )}

        <div className="rounded-md border p-3 text-sm flex justify-between">
          <div><span className="text-muted-foreground">Total added:</span> <span className="font-semibold">{computed.total_lbs.toFixed(1)} lb</span></div>
          <div><span className="text-muted-foreground">Total cost:</span> <span className="font-semibold">${(computed.total_cents / 100).toFixed(2)}</span></div>
        </div>

        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>

        <DialogFooter><Button onClick={submit} disabled={submitting}>Log purchase</Button></DialogFooter>
      </div>
    </DialogContent>
  );
}
