import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, Fuel, Clock, Wrench, Flame, Pencil, Trash2, Gauge } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import {
  GeneratorForm, FuelDialog, RuntimeDialog, MaintenanceDialog,
  TankForm, PropaneRefillDialog, PropaneLevelDialog,
  type GeneratorPayload, type FuelPayload, type RuntimePayload,
  type MaintenancePayload, type TankPayload, type PropaneRefillPayload,
} from "@/components/power/PowerDialogs";
import {
  generatorFuelPct, runtimeRemainingHrs, hoursSinceMaintenance,
  maintenanceHrsRemaining, maintenanceState, applyFuelAdd, applyRuntime,
  daysSincePropaneRefill, propaneUsageGalPerDay, propaneGallonsOnHand,
  propaneDaysRemaining, LOW_FUEL_PCT, LOW_PROPANE_PCT,
  fmtGal, fmtHrs, fmtMoney,
  type PowerGenerator, type GeneratorLog, type PropaneTank, type PropaneLog,
} from "@/lib/power";

export const Route = createFileRoute("/_authenticated/power")({ component: PowerPage });

type GeneratorRow = PowerGenerator & { homestead_id?: string; created_at?: string; updated_at?: string };
type TankRow = PropaneTank & { homestead_id?: string; created_at?: string; updated_at?: string };

const dateToISO = (d: string) => new Date(`${d}T12:00:00`).toISOString();
const fmtDate = (iso: string) => {
  try { return format(new Date(iso), "MMM d, yyyy"); } catch { return "—"; }
};
const relDays = (iso: string | null) => {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

function PowerPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [genOpen, setGenOpen] = useState(false);
  const [editGen, setEditGen] = useState<GeneratorRow | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [tankOpen, setTankOpen] = useState(false);
  const [editTank, setEditTank] = useState<TankRow | null>(null);
  const [refillOpen, setRefillOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);
  const [tankId, setTankId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["power-generators"] });
    qc.invalidateQueries({ queryKey: ["power-generator-logs"] });
    qc.invalidateQueries({ queryKey: ["power-propane-tanks"] });
    qc.invalidateQueries({ queryKey: ["power-propane-logs"] });
  };

  const { data: generators = [] } = useQuery({
    queryKey: ["power-generators"],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_generators" as never).select("*").order("name");
      if (error) throw error;
      return data as GeneratorRow[];
    },
  });
  const { data: genLogs = [] } = useQuery({
    queryKey: ["power-generator-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_generator_logs" as never).select("*").order("logged_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as GeneratorLog[];
    },
  });
  const { data: tanks = [] } = useQuery({
    queryKey: ["power-propane-tanks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_propane_tanks" as never).select("*").order("name");
      if (error) throw error;
      return data as TankRow[];
    },
  });
  const { data: propaneLogs = [] } = useQuery({
    queryKey: ["power-propane-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_propane_logs" as never).select("*").order("logged_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as PropaneLog[];
    },
  });

  const gen = useMemo(
    () => generators.find((g) => g.id === genId) ?? generators[0] ?? null,
    [generators, genId],
  );
  const tank = useMemo(
    () => tanks.find((t) => t.id === tankId) ?? tanks[0] ?? null,
    [tanks, tankId],
  );
  const genLogList = useMemo(
    () => gen ? genLogs.filter((l) => l.generator_id === gen.id).slice(0, 20) : [],
    [genLogs, gen],
  );
  const tankLogList = useMemo(
    () => tank ? propaneLogs.filter((l) => l.tank_id === tank.id).slice(0, 20) : [],
    [propaneLogs, tank],
  );

  // ---- mutations ----------------------------------------------------------
  const authed = async () => (await supabase.auth.getUser()).data.user?.id;

  const saveGenerator = useMutation({
    mutationFn: async ({ p, id }: { p: GeneratorPayload; id?: string }) => {
      const userId = await authed();
      if (id) {
        const { error } = await supabase.from("power_generators" as never).update({ ...p } as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("power_generators" as never).insert({ ...p, created_by: userId } as never);
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => { invalidate(); toast.success("Generator saved"); setGenOpen(false); setEditGen(null); if (!v.id && generators.length === 0) setGenId(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteGenerator = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("power_generators" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Generator deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const logFuel = useMutation({
    mutationFn: async (p: FuelPayload) => {
      if (!gen) throw new Error("No generator selected");
      const userId = await authed();
      const newFuel = applyFuelAdd(gen, p.gallons);
      const { error: e1 } = await supabase.from("power_generators" as never).update({ current_fuel_gal: newFuel } as never).eq("id", gen.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("power_generator_logs" as never).insert({
        generator_id: gen.id, logged_at: dateToISO(p.logged_at), kind: "fuel_add",
        fuel_gallons: p.gallons, fuel_cost_cents: p.cost_cents, notes: p.notes, created_by: userId,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Fuel logged"); setFuelOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const logRuntime = useMutation({
    mutationFn: async (p: RuntimePayload) => {
      if (!gen) throw new Error("No generator selected");
      const userId = await authed();
      const { fuelGal, totalHrs } = applyRuntime(gen, p.hours);
      const { error: e1 } = await supabase.from("power_generators" as never).update({ current_fuel_gal: fuelGal, total_runtime_hrs: totalHrs } as never).eq("id", gen.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("power_generator_logs" as never).insert({
        generator_id: gen.id, logged_at: dateToISO(p.logged_at), kind: "runtime",
        runtime_hours: p.hours, notes: p.notes, created_by: userId,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Runtime logged"); setRuntimeOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const logMaintenance = useMutation({
    mutationFn: async (p: MaintenancePayload) => {
      if (!gen) throw new Error("No generator selected");
      const userId = await authed();
      const { error: e1 } = await supabase.from("power_generators" as never).update({
        last_maintenance_type: p.maintenance_type,
        last_maintenance_at: dateToISO(p.logged_at),
        last_maintenance_hrs: Number(gen.total_runtime_hrs ?? 0),
      } as never).eq("id", gen.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("power_generator_logs" as never).insert({
        generator_id: gen.id, logged_at: dateToISO(p.logged_at), kind: "maintenance",
        maintenance_type: p.maintenance_type, notes: p.notes, created_by: userId,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Maintenance logged"); setMaintOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveTank = useMutation({
    mutationFn: async ({ p, id }: { p: TankPayload; id?: string }) => {
      const userId = await authed();
      if (id) {
        const { error } = await supabase.from("power_propane_tanks" as never).update({ name: p.name, capacity_gal: p.capacity_gal, notes: p.notes } as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("power_propane_tanks" as never).insert({ ...p, created_by: userId } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success("Tank saved"); setTankOpen(false); setEditTank(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteTank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("power_propane_tanks" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tank deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const logRefill = useMutation({
    mutationFn: async (p: PropaneRefillPayload) => {
      if (!tank) throw new Error("No tank selected");
      const userId = await authed();
      const { error: e1 } = await supabase.from("power_propane_tanks" as never).update({ current_level_pct: p.level_pct } as never).eq("id", tank.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("power_propane_logs" as never).insert({
        tank_id: tank.id, logged_at: dateToISO(p.logged_at), kind: "refill",
        gallons: p.gallons, cost_cents: p.cost_cents, level_pct: p.level_pct, notes: p.notes, created_by: userId,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Refill logged"); setRefillOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const logLevel = useMutation({
    mutationFn: async (p: { level_pct: number; logged_at: string }) => {
      if (!tank) throw new Error("No tank selected");
      const userId = await authed();
      const { error: e1 } = await supabase.from("power_propane_tanks" as never).update({ current_level_pct: p.level_pct } as never).eq("id", tank.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("power_propane_logs" as never).insert({
        tank_id: tank.id, logged_at: dateToISO(p.logged_at), kind: "level_check",
        level_pct: p.level_pct, created_by: userId,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Level saved"); setLevelOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  // ---- derived overview ---------------------------------------------------
  const fuelPct = gen ? generatorFuelPct(gen) : null;
  const runtimeLeft = gen ? runtimeRemainingHrs(gen) : null;
  const maintState = gen ? maintenanceState(gen) : "ok";
  const maintRemaining = gen ? maintenanceHrsRemaining(gen) : null;
  const tankPct = tank ? Math.min(100, Math.max(0, Number(tank.current_level_pct ?? 0))) : 0;
  const tankLogs = tank ? propaneLogs.filter((l) => l.tank_id === tank.id) : [];
  const refillAgo = daysSincePropaneRefill(tankLogs);
  const usage = propaneUsageGalPerDay(tankLogs);
  const daysLeft = tank ? propaneDaysRemaining(tank, usage) : null;

  const fuelLow = fuelPct != null && fuelPct <= LOW_FUEL_PCT;
  const propaneLow = tankPct <= LOW_PROPANE_PCT;

  const statusBadge = (state: "ok" | "warn" | "bad", label: string) => (
    <Badge variant="outline" className={
      state === "bad" ? "border-destructive text-destructive"
      : state === "warn" ? "border-warning text-warning"
      : "border-success text-success"
    }>{label}</Badge>
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-display font-semibold">Power</h1>
          <p className="text-muted-foreground">Generator, propane, and off-grid vitals.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4" /> Generator</Button></DialogTrigger>
            <GeneratorForm onSubmit={(p) => saveGenerator.mutate({ p })} submitting={saveGenerator.isPending} />
          </Dialog>
          <Dialog open={tankOpen} onOpenChange={setTankOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4" /> Propane tank</Button></DialogTrigger>
            <TankForm onSubmit={(p) => saveTank.mutate({ p })} submitting={saveTank.isPending} />
          </Dialog>
        </div>
      </div>

      {generators.length === 0 && tanks.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium mb-1">No power equipment yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add your generator and propane tank to track fuel, runtime, and maintenance.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setGenOpen(true)}><Plus className="h-4 w-4" /> Add generator</Button>
            <Button variant="outline" onClick={() => setTankOpen(true)}><Plus className="h-4 w-4" /> Add propane tank</Button>
          </div>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="generator">Generator</TabsTrigger>
            <TabsTrigger value="propane">Propane</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Generator fuel */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><Fuel className="h-4 w-4" /> Generator fuel</div>
                  {gen && statusBadge(fuelLow ? "bad" : "ok", fuelLow ? "LOW" : "OK")}
                </div>
                {gen ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-display font-semibold">{fmtGal(Number(gen.current_fuel_gal ?? 0))}</span>
                      {fuelPct != null && <span className="text-xs text-muted-foreground">{fuelPct.toFixed(0)}% of {fmtGal(Number(gen.tank_capacity_gal ?? 0))} tank</span>}
                    </div>
                    {fuelPct != null && <Progress value={fuelPct} className="h-2" />}
                    <div className="text-sm text-muted-foreground">{gen.name}{gen.fuel_type ? ` · ${gen.fuel_type}` : ""}</div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No generator added.</p>}
              </Card>

              {/* Runtime remaining */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Runtime left</div>
                {gen ? (
                  <>
                    <div className="text-2xl font-display font-semibold">{runtimeLeft != null ? fmtHrs(runtimeLeft) : "—"}</div>
                    <div className="text-sm text-muted-foreground">
                      {Number(gen.total_runtime_hrs ?? 0).toFixed(1)} hrs total
                      {Number(gen.burn_rate_gph ?? 0) > 0 ? ` · burns ${Number(gen.burn_rate_gph).toFixed(2)} gal/hr` : ""}
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No generator added.</p>}
              </Card>

              {/* Maintenance */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4" /> Maintenance</div>
                  {gen && statusBadge(maintState === "due" ? "bad" : maintState === "soon" ? "warn" : "ok",
                    maintState === "due" ? "DUE" : maintState === "soon" ? "SOON" : "OK")}
                </div>
                {gen ? (
                  <>
                    <div className="text-2xl font-display font-semibold">
                      {maintRemaining != null
                        ? maintRemaining <= 0 ? `${fmtHrs(Math.abs(maintRemaining))} overdue` : `${fmtHrs(maintRemaining)} left`
                        : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {gen.last_maintenance_type ? `${gen.last_maintenance_type} · ` : ""}
                      {gen.last_maintenance_at ? relDays(gen.last_maintenance_at) : "never logged"}
                      {` · every ${fmtHrs(Number(gen.oil_change_interval_hrs ?? 0))}`}
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No generator added.</p>}
              </Card>

              {/* Propane level */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><Flame className="h-4 w-4" /> Propane</div>
                  {tank && statusBadge(propaneLow ? "bad" : "ok", propaneLow ? "LOW" : "OK")}
                </div>
                {tank ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-display font-semibold">{tankPct.toFixed(0)}%</span>
                      <span className="text-xs text-muted-foreground">{fmtGal(propaneGallonsOnHand(tank))} of {fmtGal(Number(tank.capacity_gal ?? 0))}</span>
                    </div>
                    <Progress value={tankPct} className="h-2" />
                    <div className="text-sm text-muted-foreground">{tank.name}</div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No propane tank added.</p>}
              </Card>

              {/* Propane refill / estimate */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold"><Gauge className="h-4 w-4" /> Propane usage</div>
                {tank ? (
                  <>
                    <div className="text-2xl font-display font-semibold">
                      {daysLeft != null ? `~${Math.round(daysLeft)} days left` : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {refillAgo != null ? `Refilled ${refillAgo < 1 ? "today" : refillAgo === 1 ? "yesterday" : `${Math.round(refillAgo)} days ago`}` : "No refills logged"}
                      {usage != null ? ` · ~${usage.toFixed(1)} gal/day` : ""}
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No propane tank added.</p>}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="generator" className="space-y-4 pt-2">
            {generators.length > 1 && (
              <div className="max-w-xs">
                <Select value={gen?.id ?? ""} onValueChange={setGenId}>
                  <SelectTrigger><SelectValue placeholder="Select generator" /></SelectTrigger>
                  <SelectContent>
                    {generators.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {gen ? (
              <>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-display text-xl font-semibold">{gen.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {gen.fuel_type ?? "—"} · {fmtGal(Number(gen.tank_capacity_gal ?? 0))} tank · burns {Number(gen.burn_rate_gph ?? 0).toFixed(2)} gal/hr
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {fmtGal(Number(gen.current_fuel_gal ?? 0))} in tank · {fmtHrs(Number(gen.total_runtime_hrs ?? 0))} total
                        {gen.notes ? ` · ${gen.notes}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditGen(gen)}><Pencil className="h-3 w-3" /></Button>
                      <ConfirmDelete
                        trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                        title={`Delete ${gen.name}?`}
                        description="This removes the generator and its log history."
                        onConfirm={() => deleteGenerator.mutate(gen.id)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Dialog open={fuelOpen} onOpenChange={setFuelOpen}>
                      <DialogTrigger asChild><Button size="sm"><Fuel className="h-3 w-3" /> Add fuel</Button></DialogTrigger>
                      <FuelDialog onSubmit={(p) => logFuel.mutate(p)} submitting={logFuel.isPending} />
                    </Dialog>
                    <Dialog open={runtimeOpen} onOpenChange={setRuntimeOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Clock className="h-3 w-3" /> Log runtime</Button></DialogTrigger>
                      <RuntimeDialog onSubmit={(p) => logRuntime.mutate(p)} submitting={logRuntime.isPending} />
                    </Dialog>
                    <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Wrench className="h-3 w-3" /> Log maintenance</Button></DialogTrigger>
                      <MaintenanceDialog onSubmit={(p) => logMaintenance.mutate(p)} submitting={logMaintenance.isPending} />
                    </Dialog>
                  </div>
                </Card>

                {genLogList.length > 0 && (
                  <Card>
                    <div className="px-4 py-3 font-display font-semibold">History</div>
                    <ul className="divide-y">
                      {genLogList.map((l) => (
                        <li key={l.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-medium">
                              {l.kind === "fuel_add" && `⛽ Added ${fmtGal(Number(l.fuel_gallons ?? 0))}`}
                              {l.kind === "runtime" && `⏱ Ran ${fmtHrs(Number(l.runtime_hours ?? 0))}`}
                              {l.kind === "maintenance" && `🔧 ${l.maintenance_type ?? "Maintenance"}`}
                              {l.kind === "note" && "📝 Note"}
                            </div>
                            <div className="text-xs text-muted-foreground">{fmtDate(l.logged_at)}{l.notes ? ` · ${l.notes}` : ""}</div>
                          </div>
                          {l.kind === "fuel_add" && l.fuel_cost_cents != null && (
                            <div className="text-sm">{fmtMoney(l.fuel_cost_cents)}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No generator yet.</p>
                <Button onClick={() => setGenOpen(true)}><Plus className="h-4 w-4" /> Add generator</Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="propane" className="space-y-4 pt-2">
            {tanks.length > 1 && (
              <div className="max-w-xs">
                <Select value={tank?.id ?? ""} onValueChange={setTankId}>
                  <SelectTrigger><SelectValue placeholder="Select tank" /></SelectTrigger>
                  <SelectContent>
                    {tanks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tank ? (
              <>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-display text-xl font-semibold">{tank.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {fmtGal(Number(tank.capacity_gal ?? 0))} tank · {tankPct.toFixed(0)}% ({fmtGal(propaneGallonsOnHand(tank))} on hand)
                        {tank.notes ? ` · ${tank.notes}` : ""}
                      </div>
                      <Progress value={tankPct} className="h-2 mt-2 max-w-xs" />
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditTank(tank)}><Pencil className="h-3 w-3" /></Button>
                      <ConfirmDelete
                        trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                        title={`Delete ${tank.name}?`}
                        description="This removes the tank and its log history."
                        onConfirm={() => deleteTank.mutate(tank.id)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Dialog open={refillOpen} onOpenChange={setRefillOpen}>
                      <DialogTrigger asChild><Button size="sm"><Flame className="h-3 w-3" /> Log refill</Button></DialogTrigger>
                      <PropaneRefillDialog onSubmit={(p) => logRefill.mutate(p)} submitting={logRefill.isPending} />
                    </Dialog>
                    <Dialog open={levelOpen} onOpenChange={setLevelOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Gauge className="h-3 w-3" /> Update level</Button></DialogTrigger>
                      <PropaneLevelDialog onSubmit={(p) => logLevel.mutate(p)} submitting={logLevel.isPending} />
                    </Dialog>
                  </div>
                </Card>

                {tankLogList.length > 0 && (
                  <Card>
                    <div className="px-4 py-3 font-display font-semibold">History</div>
                    <ul className="divide-y">
                      {tankLogList.map((l) => (
                        <li key={l.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-medium">
                              {l.kind === "refill" && `🧯 Refilled ${fmtGal(Number(l.gallons ?? 0))}${l.level_pct != null ? ` → ${Number(l.level_pct).toFixed(0)}%` : ""}`}
                              {l.kind === "level_check" && `📊 Level: ${Number(l.level_pct ?? 0).toFixed(0)}%`}
                              {l.kind === "note" && "📝 Note"}
                            </div>
                            <div className="text-xs text-muted-foreground">{fmtDate(l.logged_at)}{l.notes ? ` · ${l.notes}` : ""}</div>
                          </div>
                          {l.kind === "refill" && l.cost_cents != null && (
                            <div className="text-sm">{fmtMoney(l.cost_cents)}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No propane tank yet.</p>
                <Button onClick={() => setTankOpen(true)}><Plus className="h-4 w-4" /> Add propane tank</Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {editGen && (
        <Dialog open onOpenChange={(o) => !o && setEditGen(null)}>
          <GeneratorForm initial={editGen} onSubmit={(p) => saveGenerator.mutate({ p, id: editGen.id })} submitting={saveGenerator.isPending} />
        </Dialog>
      )}
      {editTank && (
        <Dialog open onOpenChange={(o) => !o && setEditTank(null)}>
          <TankForm initial={editTank} onSubmit={(p) => saveTank.mutate({ p, id: editTank.id })} submitting={saveTank.isPending} />
        </Dialog>
      )}
    </div>
  );
}
