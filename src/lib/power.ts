// Power section logic: generator + propane tracking for off-grid life.
//
// Pure functions only (no fetch, no React) so the math is unit testable.
// See src/lib/__tests__/power.test.ts. The UI reads only what this module
// returns.
//
// Design notes:
//   - Fuel level is tracked directly on the generator row (gallons), updated
//     by quick-log actions — no flow-meter math, just "I added 5 gallons".
//   - Runtime logging decrements fuel using the generator's burn rate
//     (gal/hr, user-tunable, default 0.75 for a mid-size gas generator).
//   - Maintenance is hours-based (the generator-world standard), not
//     calendar-based: due when runtime since last service >= interval.
//   - Propane usage is estimated from refill history: gallons added at a
//     refill / days since the previous refill, averaged over recent refills.

export interface PowerGenerator {
  id: string;
  name: string;
  fuel_type: string | null;
  tank_capacity_gal: number | null;
  burn_rate_gph: number | null;
  current_fuel_gal: number | null;
  total_runtime_hrs: number | null;
  oil_change_interval_hrs: number | null;
  last_maintenance_type: string | null;
  last_maintenance_at: string | null;
  last_maintenance_hrs: number | null;
  notes: string | null;
}

export interface GeneratorLog {
  id: string;
  generator_id: string;
  logged_at: string;
  kind: "fuel_add" | "runtime" | "maintenance" | "note";
  fuel_gallons: number | null;
  fuel_cost_cents: number | null;
  runtime_hours: number | null;
  maintenance_type: string | null;
  notes: string | null;
}

export interface PropaneTank {
  id: string;
  name: string;
  capacity_gal: number | null;
  current_level_pct: number | null;
  notes: string | null;
}

export interface PropaneLog {
  id: string;
  tank_id: string;
  logged_at: string;
  kind: "refill" | "level_check" | "note";
  level_pct: number | null;
  gallons: number | null;
  cost_cents: number | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Fuel at/below this % of tank → low-fuel warning on the overview. */
export const LOW_FUEL_PCT = 25;
/** Propane at/below this % → low warning on the overview. */
export const LOW_PROPANE_PCT = 20;
/** Maintenance within this many runtime hours → "due soon" (not yet overdue). */
export const MAINTENANCE_SOON_HRS = 10;
/** Max refills back to average for the propane usage estimate. */
export const PROPANE_USAGE_REFILLS = 3;

// ---------------------------------------------------------------------------
// Generator math
// ---------------------------------------------------------------------------

const num = (v: number | null | undefined, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Current fuel as a % of tank capacity (0–100). Null when capacity unknown. */
export function generatorFuelPct(g: PowerGenerator): number | null {
  const cap = num(g.tank_capacity_gal);
  if (cap <= 0) return null;
  return Math.min(100, Math.max(0, (num(g.current_fuel_gal) / cap) * 100));
}

/** Estimated runtime hours left at the current burn rate. Null if unknown. */
export function runtimeRemainingHrs(g: PowerGenerator): number | null {
  const burn = num(g.burn_rate_gph);
  if (burn <= 0) return null;
  return Math.max(0, num(g.current_fuel_gal) / burn);
}

/** Runtime hours since the last logged maintenance. */
export function hoursSinceMaintenance(g: PowerGenerator): number {
  return Math.max(0, num(g.total_runtime_hrs) - num(g.last_maintenance_hrs));
}

/** Hours of runtime remaining before maintenance is due (negative = overdue). */
export function maintenanceHrsRemaining(g: PowerGenerator): number | null {
  const interval = num(g.oil_change_interval_hrs);
  if (interval <= 0) return null;
  return interval - hoursSinceMaintenance(g);
}

export type MaintenanceState = "ok" | "soon" | "due";

/** ok → plenty of hours left; soon → within MAINTENANCE_SOON_HRS; due → overdue. */
export function maintenanceState(g: PowerGenerator): MaintenanceState {
  const remaining = maintenanceHrsRemaining(g);
  if (remaining == null) return "ok";
  if (remaining <= 0) return "due";
  if (remaining <= MAINTENANCE_SOON_HRS) return "soon";
  return "ok";
}

/**
 * Apply a fuel add: returns the new fuel level, clamped to [0, tank capacity].
 * When capacity is unknown (0), the level just increases.
 */
export function applyFuelAdd(g: PowerGenerator, gallons: number): number {
  const cap = num(g.tank_capacity_gal);
  const next = num(g.current_fuel_gal) + Math.max(0, gallons);
  return cap > 0 ? Math.min(cap, next) : next;
}

/**
 * Apply a runtime log: returns { fuelGal, totalHrs }. Fuel drops by
 * hours × burn rate, floored at 0; total runtime always increases.
 */
export function applyRuntime(
  g: PowerGenerator,
  hours: number,
): { fuelGal: number; totalHrs: number } {
  const h = Math.max(0, hours);
  const burn = num(g.burn_rate_gph);
  return {
    fuelGal: Math.max(0, num(g.current_fuel_gal) - h * burn),
    totalHrs: num(g.total_runtime_hrs) + h,
  };
}

/**
 * Actual measured burn rate (gal/hr) from logged history:
 * total fuel added ÷ total runtime logged. Null until the user has logged
 * at least one fuel add AND at least one runtime entry.
 */
export function actualBurnRateGph(logs: GeneratorLog[]): number | null {
  const fuel = logs
    .filter((l) => l.kind === "fuel_add")
    .reduce((s, l) => s + num(l.fuel_gallons), 0);
  const hrs = logs
    .filter((l) => l.kind === "runtime")
    .reduce((s, l) => s + num(l.runtime_hours), 0);
  if (fuel <= 0 || hrs <= 0) return null;
  return fuel / hrs;
}

// ---------------------------------------------------------------------------
// Propane math
// ---------------------------------------------------------------------------

const dayMs = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / dayMs);
}

/** Days since the most recent refill log. Null when never refilled. */
export function daysSincePropaneRefill(logs: PropaneLog[], now: Date = new Date()): number | null {
  const refills = logs
    .filter((l) => l.kind === "refill")
    .sort((a, b) => +new Date(b.logged_at) - +new Date(a.logged_at));
  if (refills.length === 0) return null;
  return Math.max(0, (now.getTime() - new Date(refills[0].logged_at).getTime()) / dayMs);
}

/**
 * Estimated propane use in gallons/day from refill history.
 * For each consecutive refill pair (older → newer): newer.gallons / days
 * between them. Averages up to PROPANE_USAGE_REFILLS recent intervals.
 * Null when there aren't at least two refills with usable data.
 */
export function propaneUsageGalPerDay(logs: PropaneLog[]): number | null {
  const refills = logs
    .filter((l) => l.kind === "refill" && num(l.gallons) > 0)
    .sort((a, b) => +new Date(a.logged_at) - +new Date(b.logged_at));
  if (refills.length < 2) return null;
  const rates: number[] = [];
  const pairs = refills.slice(-(PROPANE_USAGE_REFILLS + 1));
  for (let i = 1; i < pairs.length; i++) {
    const days = daysBetween(pairs[i - 1].logged_at, pairs[i].logged_at);
    if (days > 0) rates.push(num(pairs[i].gallons) / days);
  }
  if (rates.length === 0) return null;
  return rates.reduce((s, r) => s + r, 0) / rates.length;
}

/** Gallons currently in the tank from capacity × level %. */
export function propaneGallonsOnHand(t: PropaneTank): number {
  return (num(t.capacity_gal) * Math.min(100, Math.max(0, num(t.current_level_pct)))) / 100;
}

/**
 * Estimated days of propane remaining at the given burn rate.
 * Null when the rate is unknown or the tank is empty.
 */
export function propaneDaysRemaining(t: PropaneTank, galPerDay: number | null): number | null {
  if (galPerDay == null || galPerDay <= 0) return null;
  const onHand = propaneGallonsOnHand(t);
  if (onHand <= 0) return 0;
  return onHand / galPerDay;
}

/** Clamp a level % into 0–100. */
export function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Formatting helpers (plain, consistent across the section)
// ---------------------------------------------------------------------------

export function fmtGal(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} gal`;
}

export function fmtHrs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} hrs`;
}

export function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
