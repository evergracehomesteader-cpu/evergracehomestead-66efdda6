import { describe, expect, it } from "vitest";
import {
  applyFuelAdd,
  applyRuntime,
  actualBurnRateGph,
  clampPct,
  daysSincePropaneRefill,
  generatorFuelPct,
  hoursSinceMaintenance,
  LOW_FUEL_PCT,
  LOW_PROPANE_PCT,
  maintenanceHrsRemaining,
  maintenanceState,
  propaneDaysRemaining,
  propaneGallonsOnHand,
  propaneUsageGalPerDay,
  runtimeRemainingHrs,
  type GeneratorLog,
  type PowerGenerator,
  type PropaneLog,
  type PropaneTank,
} from "../power";

const gen = (overrides: Partial<PowerGenerator> = {}): PowerGenerator => ({
  id: "g1",
  name: "Big Red",
  fuel_type: "gasoline",
  tank_capacity_gal: 10,
  burn_rate_gph: 1,
  current_fuel_gal: 5,
  total_runtime_hrs: 120,
  oil_change_interval_hrs: 100,
  last_maintenance_type: "Oil change",
  last_maintenance_at: "2026-09-01T00:00:00Z",
  last_maintenance_hrs: 100,
  notes: null,
  ...overrides,
});

const tank = (overrides: Partial<PropaneTank> = {}): PropaneTank => ({
  id: "t1",
  name: "House tank",
  capacity_gal: 250,
  current_level_pct: 50,
  notes: null,
  ...overrides,
});

const plog = (overrides: Partial<PropaneLog> = {}): PropaneLog => ({
  id: "p1",
  tank_id: "t1",
  logged_at: "2026-10-01T12:00:00Z",
  kind: "refill",
  level_pct: 80,
  gallons: 100,
  cost_cents: 25000,
  notes: null,
  ...overrides,
});

describe("generatorFuelPct", () => {
  it("computes percent of tank", () => {
    expect(generatorFuelPct(gen())).toBe(50);
    expect(generatorFuelPct(gen({ current_fuel_gal: 10 }))).toBe(100);
    expect(generatorFuelPct(gen({ current_fuel_gal: 0 }))).toBe(0);
  });
  it("clamps overfilled levels to 100", () => {
    expect(generatorFuelPct(gen({ current_fuel_gal: 12 }))).toBe(100);
  });
  it("returns null when capacity is unknown", () => {
    expect(generatorFuelPct(gen({ tank_capacity_gal: 0 }))).toBeNull();
    expect(generatorFuelPct(gen({ tank_capacity_gal: null }))).toBeNull();
  });
});

describe("runtimeRemainingHrs", () => {
  it("divides fuel by burn rate", () => {
    expect(runtimeRemainingHrs(gen())).toBe(5);
    expect(runtimeRemainingHrs(gen({ current_fuel_gal: 7.5, burn_rate_gph: 0.5 }))).toBe(15);
  });
  it("returns null when burn rate is unknown", () => {
    expect(runtimeRemainingHrs(gen({ burn_rate_gph: 0 }))).toBeNull();
    expect(runtimeRemainingHrs(gen({ burn_rate_gph: null }))).toBeNull();
  });
});

describe("maintenance math", () => {
  it("hoursSinceMaintenance uses runtime delta", () => {
    expect(hoursSinceMaintenance(gen())).toBe(20);
    expect(hoursSinceMaintenance(gen({ total_runtime_hrs: 90, last_maintenance_hrs: 100 }))).toBe(0);
  });
  it("maintenanceHrsRemaining counts down to the interval", () => {
    expect(maintenanceHrsRemaining(gen())).toBe(80);
    expect(maintenanceHrsRemaining(gen({ total_runtime_hrs: 205, last_maintenance_hrs: 100 }))).toBe(-5);
  });
  it("returns null without an interval", () => {
    expect(maintenanceHrsRemaining(gen({ oil_change_interval_hrs: 0 }))).toBeNull();
  });
  it("maintenanceState: ok / soon / due", () => {
    expect(maintenanceState(gen())).toBe("ok"); // 80 hrs left
    expect(maintenanceState(gen({ total_runtime_hrs: 195, last_maintenance_hrs: 100 }))).toBe("soon"); // 5 left
    expect(maintenanceState(gen({ total_runtime_hrs: 200, last_maintenance_hrs: 100 }))).toBe("due"); // 0 left
    expect(maintenanceState(gen({ total_runtime_hrs: 250, last_maintenance_hrs: 100 }))).toBe("due"); // overdue
  });
});

describe("applyFuelAdd", () => {
  it("adds gallons and clamps to capacity", () => {
    expect(applyFuelAdd(gen(), 3)).toBe(8);
    expect(applyFuelAdd(gen(), 10)).toBe(10); // clamped
  });
  it("ignores negative adds", () => {
    expect(applyFuelAdd(gen(), -5)).toBe(5);
  });
  it("adds freely when capacity unknown", () => {
    expect(applyFuelAdd(gen({ tank_capacity_gal: 0, current_fuel_gal: 5 }), 3)).toBe(8);
  });
});

describe("applyRuntime", () => {
  it("adds hours and burns fuel", () => {
    const r = applyRuntime(gen(), 2);
    expect(r.totalHrs).toBe(122);
    expect(r.fuelGal).toBe(3);
  });
  it("floors fuel at zero", () => {
    const r = applyRuntime(gen(), 10);
    expect(r.fuelGal).toBe(0);
    expect(r.totalHrs).toBe(130);
  });
  it("ignores negative hours", () => {
    const r = applyRuntime(gen(), -4);
    expect(r.totalHrs).toBe(120);
    expect(r.fuelGal).toBe(5);
  });
});

describe("daysSincePropaneRefill", () => {
  it("measures from the latest refill", () => {
    const logs = [
      plog({ id: "a", logged_at: "2026-09-01T12:00:00Z" }),
      plog({ id: "b", logged_at: "2026-10-01T12:00:00Z" }),
      plog({ id: "c", logged_at: "2026-10-01T12:00:00Z", kind: "level_check" }),
    ];
    expect(daysSincePropaneRefill(logs, new Date("2026-10-11T12:00:00Z"))).toBe(10);
  });
  it("returns null with no refills", () => {
    expect(daysSincePropaneRefill([plog({ kind: "note" })])).toBeNull();
    expect(daysSincePropaneRefill([])).toBeNull();
  });
});

describe("propaneUsageGalPerDay", () => {
  it("averages gallons per day between refills", () => {
    const logs = [
      plog({ id: "a", logged_at: "2026-09-01T12:00:00Z", gallons: 50 }),
      plog({ id: "b", logged_at: "2026-09-11T12:00:00Z", gallons: 100 }), // 100 gal / 10 days
      plog({ id: "c", logged_at: "2026-09-21T12:00:00Z", gallons: 50 }), // 50 gal / 10 days
    ];
    expect(propaneUsageGalPerDay(logs)).toBeCloseTo(7.5, 5);
  });
  it("returns null with fewer than two refills", () => {
    expect(propaneUsageGalPerDay([plog()])).toBeNull();
    expect(propaneUsageGalPerDay([])).toBeNull();
  });
  it("skips zero-gallon refills", () => {
    const logs = [
      plog({ id: "a", logged_at: "2026-09-01T12:00:00Z", gallons: 0 }),
      plog({ id: "b", logged_at: "2026-09-11T12:00:00Z", gallons: 100 }),
    ];
    expect(propaneUsageGalPerDay(logs)).toBeNull();
  });
});

describe("propaneDaysRemaining", () => {
  it("divides on-hand gallons by daily use", () => {
    // 250 gal tank at 50% = 125 gal; 5 gal/day → 25 days
    expect(propaneDaysRemaining(tank(), 5)).toBe(25);
  });
  it("returns 0 when the tank is empty", () => {
    expect(propaneDaysRemaining(tank({ current_level_pct: 0 }), 5)).toBe(0);
  });
  it("returns null when usage unknown", () => {
    expect(propaneDaysRemaining(tank(), null)).toBeNull();
    expect(propaneDaysRemaining(tank(), 0)).toBeNull();
  });
});

describe("propaneGallonsOnHand", () => {
  it("multiplies capacity by level", () => {
    expect(propaneGallonsOnHand(tank())).toBe(125);
    expect(propaneGallonsOnHand(tank({ current_level_pct: 80 }))).toBe(200);
  });
});

describe("clampPct", () => {
  it("clamps to 0–100", () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(42)).toBe(42);
  });
});

describe("thresholds", () => {
  it("are sane", () => {
    expect(LOW_FUEL_PCT).toBe(25);
    expect(LOW_PROPANE_PCT).toBe(20);
  });
});

const glog = (overrides: Partial<GeneratorLog> = {}): GeneratorLog => ({
  id: "l1",
  generator_id: "g1",
  logged_at: "2026-10-01T12:00:00Z",
  kind: "fuel_add",
  fuel_gallons: null,
  fuel_cost_cents: null,
  runtime_hours: null,
  maintenance_type: null,
  notes: null,
  ...overrides,
});

describe("actualBurnRateGph", () => {
  it("returns null with no logs", () => {
    expect(actualBurnRateGph([])).toBeNull();
  });
  it("returns null with only fuel logs", () => {
    expect(actualBurnRateGph([glog({ fuel_gallons: 4.3 })])).toBeNull();
  });
  it("returns null with only runtime logs", () => {
    expect(actualBurnRateGph([glog({ kind: "runtime", runtime_hours: 13 })])).toBeNull();
  });
  it("computes total fuel ÷ total runtime", () => {
    const logs = [
      glog({ id: "a", fuel_gallons: 4.3 }),
      glog({ id: "b", kind: "runtime", runtime_hours: 13 }),
    ];
    expect(actualBurnRateGph(logs)).toBeCloseTo(4.3 / 13, 4);
  });
  it("sums across multiple entries", () => {
    const logs = [
      glog({ id: "a", fuel_gallons: 2 }),
      glog({ id: "b", fuel_gallons: 2.3 }),
      glog({ id: "c", kind: "runtime", runtime_hours: 6 }),
      glog({ id: "d", kind: "runtime", runtime_hours: 7 }),
    ];
    expect(actualBurnRateGph(logs)).toBeCloseTo(4.3 / 13, 4);
  });
  it("ignores maintenance and note logs", () => {
    const logs = [
      glog({ id: "a", fuel_gallons: 4.3 }),
      glog({ id: "b", kind: "runtime", runtime_hours: 13 }),
      glog({ id: "c", kind: "maintenance", maintenance_type: "Oil change" }),
      glog({ id: "d", kind: "note", notes: "hello" }),
    ];
    expect(actualBurnRateGph(logs)).toBeCloseTo(4.3 / 13, 4);
  });
});
