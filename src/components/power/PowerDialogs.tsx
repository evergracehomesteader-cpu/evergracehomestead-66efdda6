import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { todayLocal } from "@/lib/dates";
import type { PowerGenerator, PropaneTank } from "@/lib/power";
import {
  GENERATOR_MODELS,
  findGeneratorModel,
  searchGeneratorModels,
  generatorModelLabel,
  type GeneratorModel,
} from "@/lib/generator-models";

const dollarsToCents = (s: string): number | null =>
  s.trim() === "" ? null : Math.round(Number(s) * 100);

const numOr = (s: string, fallback: number): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

// ---------------------------------------------------------------------------
// Generator profile form (add / edit)
// ---------------------------------------------------------------------------

export type GeneratorPayload = {
  name: string;
  fuel_type: string;
  tank_capacity_gal: number;
  burn_rate_gph: number;
  oil_change_interval_hrs: number;
  current_fuel_gal: number;
  notes: string | null;
};

export function GeneratorForm({
  initial, onSubmit, submitting,
}: {
  initial?: PowerGenerator;
  onSubmit: (p: GeneratorPayload) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [fuelType, setFuelType] = useState(initial?.fuel_type ?? "gasoline");
  const [capacity, setCapacity] = useState(String(initial?.tank_capacity_gal ?? ""));
  const [burn, setBurn] = useState(String(initial?.burn_rate_gph ?? 0.75));
  const [interval, setInterval] = useState(String(initial?.oil_change_interval_hrs ?? 100));
  const [fuel, setFuel] = useState(String(initial?.current_fuel_gal ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // Model lookup (add mode only): picking a model pre-fills specs.
  const [modelId, setModelId] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedModel: GeneratorModel | undefined = modelId ? findGeneratorModel(modelId) : undefined;
  const modelMatches = searchGeneratorModels(modelQuery);

  const pickModel = (m: GeneratorModel | null) => {
    setModelId(m?.id ?? "");
    setModelQuery("");
    setPickerOpen(false);
    if (m) {
      setCapacity(String(m.tank_gal));
      setFuelType(m.fuel_type);
      setBurn(String(m.est_burn_gph));
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit generator" : "Add generator"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Name required"); return; }
          onSubmit({
            name: name.trim(),
            fuel_type: fuelType,
            tank_capacity_gal: numOr(capacity, 0),
            burn_rate_gph: numOr(burn, 0.75),
            oil_change_interval_hrs: numOr(interval, 100),
            current_fuel_gal: numOr(fuel, 0),
            notes: notes.trim() || null,
          });
        }}
        className="space-y-3"
      >
        {!initial && (
          <div className="relative">
            <Label>Model (optional)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              onClick={() => setPickerOpen((o) => !o)}
            >
              <span className="truncate">
                {selectedModel ? generatorModelLabel(selectedModel) : "Select a model to pre-fill specs…"}
              </span>
              <span className="text-muted-foreground">▾</span>
            </Button>
            {pickerOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                <div className="p-2 border-b">
                  <Input
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="Search models…"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  <button
                    type="button"
                    className="w-full text-left px-2 py-2 rounded text-sm hover:bg-accent"
                    onClick={() => pickModel(null)}
                  >
                    Custom / not listed
                  </button>
                  {modelMatches.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      className={`w-full text-left px-2 py-2 rounded text-sm hover:bg-accent ${mod.id === modelId ? "bg-accent" : ""}`}
                      onClick={() => pickModel(mod)}
                    >
                      <div className="font-medium">{generatorModelLabel(mod)}</div>
                      <div className="text-xs text-muted-foreground">
                        {mod.tank_gal} gal tank · {mod.runtime_hrs} hrs at {mod.runtime_load_note} → est. {mod.est_burn_gph.toFixed(2)} gal/hr
                      </div>
                    </button>
                  ))}
                  {modelMatches.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No models match — pick "Custom / not listed".</p>
                  )}
                </div>
              </div>
            )}
            {selectedModel && (
              <p className="text-xs text-muted-foreground mt-1">
                Spec: {selectedModel.tank_gal} gal tank · {selectedModel.runtime_hrs} hrs at {selectedModel.runtime_load_note} → est. {selectedModel.est_burn_gph.toFixed(2)} gal/hr. You can still change any field below.
              </p>
            )}
          </div>
        )}
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Big Red" maxLength={100} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fuel type</Label>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gasoline">Gasoline</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="propane">Propane</SelectItem>
                <SelectItem value="natural_gas">Natural gas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Tank size (gal)</Label><Input type="number" step="0.1" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="10" /></div>
          <div><Label>Burn rate (gal/hr)</Label><Input type="number" step="0.05" min="0" value={burn} onChange={(e) => setBurn(e.target.value)} placeholder="0.75" /></div>
          <div><Label>Oil change every (hrs)</Label><Input type="number" step="1" min="0" value={interval} onChange={(e) => setInterval(e.target.value)} placeholder="100" /></div>
        </div>
        {!initial && (
          <div><Label>Current fuel in tank (gal)</Label><Input type="number" step="0.1" min="0" value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="0" /></div>
        )}
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Quick log: add fuel
// ---------------------------------------------------------------------------

export type FuelPayload = { gallons: number; cost_cents: number | null; logged_at: string; notes: string | null };

export function FuelDialog({ onSubmit, submitting }: { onSubmit: (p: FuelPayload) => void; submitting: boolean }) {
  const [gallons, setGallons] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add fuel</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const g = Number(gallons);
          if (!Number.isFinite(g) || g <= 0) { toast.error("Enter gallons added"); return; }
          onSubmit({ gallons: g, cost_cents: dollarsToCents(cost), logged_at: date, notes: notes.trim() || null });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Gallons added *</Label><Input type="number" step="0.1" min="0" value={gallons} onChange={(e) => setGallons(e.target.value)} placeholder="5" required autoFocus /></div>
          <div><Label>Cost ($, optional)</Label><Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="18.50" /></div>
        </div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Log fuel</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Quick log: runtime
// ---------------------------------------------------------------------------

export type RuntimePayload = { hours: number; logged_at: string; notes: string | null };

export function RuntimeDialog({ onSubmit, submitting }: { onSubmit: (p: RuntimePayload) => void; submitting: boolean }) {
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log runtime</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(hours);
          if (!Number.isFinite(h) || h <= 0) { toast.error("Enter hours run"); return; }
          onSubmit({ hours: h, logged_at: date, notes: notes.trim() || null });
        }}
        className="space-y-3"
      >
        <div><Label>Hours run *</Label><Input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="6" required autoFocus /></div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Log runtime</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Quick log: maintenance
// ---------------------------------------------------------------------------

export type MaintenancePayload = { maintenance_type: string; logged_at: string; notes: string | null };

const MAINT_TYPES = ["Oil change", "Air filter", "Spark plug", "Fuel filter", "Valve check", "General service"];

export function MaintenanceDialog({ onSubmit, submitting }: { onSubmit: (p: MaintenancePayload) => void; submitting: boolean }) {
  const [type, setType] = useState(MAINT_TYPES[0]);
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log maintenance</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ maintenance_type: type, logged_at: date, notes: notes.trim() || null });
        }}
        className="space-y-3"
      >
        <div>
          <Label>Service</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MAINT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Log maintenance</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Propane tank form (add / edit)
// ---------------------------------------------------------------------------

export type TankPayload = { name: string; capacity_gal: number; current_level_pct: number; notes: string | null };

export function TankForm({
  initial, onSubmit, submitting,
}: {
  initial?: PropaneTank;
  onSubmit: (p: TankPayload) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity_gal ?? ""));
  const [level, setLevel] = useState(String(initial?.current_level_pct ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit propane tank" : "Add propane tank"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Name required"); return; }
          onSubmit({
            name: name.trim(),
            capacity_gal: numOr(capacity, 0),
            current_level_pct: Math.min(100, Math.max(0, numOr(level, 0))),
            notes: notes.trim() || null,
          });
        }}
        className="space-y-3"
      >
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="House tank" maxLength={100} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tank size (gal)</Label><Input type="number" step="1" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="250" /></div>
          {!initial && (
            <div><Label>Current level (%)</Label><Input type="number" step="1" min="0" max="100" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="60" /></div>
          )}
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Quick log: propane refill
// ---------------------------------------------------------------------------

export type PropaneRefillPayload = {
  gallons: number; cost_cents: number | null; level_pct: number; logged_at: string; notes: string | null;
};

export function PropaneRefillDialog({ onSubmit, submitting }: { onSubmit: (p: PropaneRefillPayload) => void; submitting: boolean }) {
  const [gallons, setGallons] = useState("");
  const [cost, setCost] = useState("");
  const [level, setLevel] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log propane refill</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const g = Number(gallons);
          if (!Number.isFinite(g) || g <= 0) { toast.error("Enter gallons delivered"); return; }
          onSubmit({
            gallons: g,
            cost_cents: dollarsToCents(cost),
            level_pct: Math.min(100, Math.max(0, numOr(level, 0))),
            logged_at: date,
            notes: notes.trim() || null,
          });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Gallons delivered *</Label><Input type="number" step="0.1" min="0" value={gallons} onChange={(e) => setGallons(e.target.value)} placeholder="120" required autoFocus /></div>
          <div><Label>Cost ($, optional)</Label><Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="240.00" /></div>
        </div>
        <div><Label>Gauge after fill (%)</Label><Input type="number" step="1" min="0" max="100" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="80" /></div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Log refill</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Quick log: propane level check
// ---------------------------------------------------------------------------

export function PropaneLevelDialog({ onSubmit, submitting }: { onSubmit: (p: { level_pct: number; logged_at: string }) => void; submitting: boolean }) {
  const [level, setLevel] = useState("");
  const [date, setDate] = useState(todayLocal());
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Update propane level</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const l = Number(level);
          if (!Number.isFinite(l) || l < 0 || l > 100) { toast.error("Enter a level 0–100"); return; }
          onSubmit({ level_pct: l, logged_at: date });
        }}
        className="space-y-3"
      >
        <div><Label>Gauge reading (%) *</Label><Input type="number" step="1" min="0" max="100" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="55" required autoFocus /></div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save level</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
