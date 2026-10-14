import { describe, expect, it } from "vitest";
import {
  computeWeatherAlerts,
  coldVulnerable,
  hasPregnantAnimals,
  NEWBORN_COLD_F,
  FREEZE_F,
  FREEZE_RISK_F,
  HEAT_CRITICAL_F,
  HEAT_WATCH_F,
  NEWBORN_DAYS,
  type AlertAnimal,
  type ForecastDay,
} from "../weather-alerts";

const NOW = new Date("2026-10-13T12:00:00");

function day(
  date: string,
  overrides: Partial<ForecastDay> = {}
): ForecastDay {
  return {
    date,
    tempMax: 70,
    tempMin: 55,
    apparentMax: 72,
    weatherCode: 2,
    precipProbMax: 10,
    windSpeedMax: 8,
    ...overrides,
  };
}

function animal(overrides: Partial<AlertAnimal> = {}): AlertAnimal {
  return {
    id: "a1",
    name: "Melania",
    species: "goat",
    status: "active",
    date_of_birth: "2025-09-11",
    breeding_status: null,
    ...overrides,
  };
}

const daysAgo = (n: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

describe("computeWeatherAlerts", () => {
  it("returns no alerts for mild weather", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13"), day("2026-10-14"), day("2026-10-15")],
      [animal()],
      NOW
    );
    expect(alerts).toEqual([]);
  });

  it("returns no alerts for an empty forecast", () => {
    expect(computeWeatherAlerts([], [animal()], NOW)).toEqual([]);
  });

  it("fires a critical hard-freeze alert at or below 32°F", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: FREEZE_F })],
      [animal()],
      NOW
    );
    const freeze = alerts.find((a) => a.kind === "freeze");
    expect(freeze).toBeDefined();
    expect(freeze!.severity).toBe("critical");
    expect(freeze!.detail).toContain(`${FREEZE_F}°F`);
  });

  it("fires a watch-level near-freeze alert between 33°F and 36°F", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: FREEZE_RISK_F })],
      [animal()],
      NOW
    );
    const freeze = alerts.find((a) => a.kind === "freeze");
    expect(freeze).toBeDefined();
    expect(freeze!.severity).toBe("watch");
  });

  it("fires one freeze alert for a multi-day cold snap, naming the coldest night", () => {
    const alerts = computeWeatherAlerts(
      [
        day("2026-10-13", { tempMin: 34 }),
        day("2026-10-14", { tempMin: 28 }),
        day("2026-10-15", { tempMin: 30 }),
      ],
      [animal()],
      NOW
    );
    const freezes = alerts.filter((a) => a.kind === "freeze");
    expect(freezes).toHaveLength(1);
    expect(freezes[0].detail).toContain("28°F");
    expect(freezes[0].id).toContain("2026-10-14");
  });

  it("escalates to a newborn-cold alert when kids are under 14 days old", () => {
    const kid = animal({ name: "Kid1", date_of_birth: daysAgo(5) });
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: NEWBORN_COLD_F })],
      [kid],
      NOW
    );
    const nb = alerts.find((a) => a.kind === "newborn-cold");
    expect(nb).toBeDefined();
    expect(nb!.severity).toBe("critical");
    expect(nb!.detail).toContain("1 kids");
    expect(nb!.detail).toContain("shelter");
  });

  it("does not fire a newborn alert for animals older than the newborn window", () => {
    const older = animal({ date_of_birth: daysAgo(NEWBORN_DAYS + 1) });
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: NEWBORN_COLD_F })],
      [older],
      NOW
    );
    expect(alerts.find((a) => a.kind === "newborn-cold")).toBeUndefined();
  });

  it("does not fire a newborn alert when nights stay mild", () => {
    const kid = animal({ date_of_birth: daysAgo(3) });
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: 55 })],
      [kid],
      NOW
    );
    expect(alerts.find((a) => a.kind === "newborn-cold")).toBeUndefined();
  });

  it("groups newborns by species in the alert copy", () => {
    const animals = [
      animal({ id: "k1", date_of_birth: daysAgo(2), species: "goat" }),
      animal({ id: "k2", date_of_birth: daysAgo(2), species: "goat" }),
      animal({ id: "p1", date_of_birth: daysAgo(2), species: "pig" }),
    ];
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { tempMin: 38 })],
      animals,
      NOW
    );
    const nb = alerts.find((a) => a.kind === "newborn-cold");
    expect(nb!.detail).toContain("2 kids and 1 piglets");
  });

  it("fires a critical heat alert at feels-like 100°F+", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { apparentMax: HEAT_CRITICAL_F })],
      [animal()],
      NOW
    );
    const heat = alerts.find((a) => a.kind === "heat");
    expect(heat).toBeDefined();
    expect(heat!.severity).toBe("critical");
  });

  it("fires a watch-level heat alert at feels-like 95–99°F", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { apparentMax: HEAT_WATCH_F })],
      [animal()],
      NOW
    );
    const heat = alerts.find((a) => a.kind === "heat");
    expect(heat).toBeDefined();
    expect(heat!.severity).toBe("watch");
  });

  it("mentions pregnant animals in heat copy when present", () => {
    const doe = animal({ breeding_status: "confirmed_pregnant" });
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { apparentMax: 101 })],
      [doe],
      NOW
    );
    const heat = alerts.find((a) => a.kind === "heat");
    expect(heat!.detail).toContain("pregnant");
  });

  it("fires a storm alert for thunderstorms with real rain odds", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { weatherCode: 95, precipProbMax: 60 })],
      [animal()],
      NOW
    );
    const storm = alerts.find((a) => a.kind === "storm");
    expect(storm).toBeDefined();
    expect(storm!.severity).toBe("warning");
    expect(storm!.detail).toContain("60%");
  });

  it("does not fire a storm alert for low-probability thunder codes", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { weatherCode: 96, precipProbMax: 10 })],
      [animal()],
      NOW
    );
    expect(alerts.find((a) => a.kind === "storm")).toBeUndefined();
  });

  it("fires a wind alert at 40+ mph", () => {
    const alerts = computeWeatherAlerts(
      [day("2026-10-13", { windSpeedMax: 45 })],
      [animal()],
      NOW
    );
    const wind = alerts.find((a) => a.kind === "wind");
    expect(wind).toBeDefined();
    expect(wind!.severity).toBe("warning");
    expect(wind!.detail).toContain("45 mph");
  });

  it("orders critical alerts before warnings and watches", () => {
    const alerts = computeWeatherAlerts(
      [
        day("2026-10-13", {
          tempMin: 30,
          apparentMax: 97,
          weatherCode: 95,
          precipProbMax: 70,
        }),
      ],
      [animal()],
      NOW
    );
    const severities = alerts.map((a) => a.severity);
    const rank = { critical: 0, warning: 1, watch: 2 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(rank[severities[i]]).toBeGreaterThanOrEqual(rank[severities[i - 1]]);
    }
    expect(alerts[0].severity).toBe("critical");
  });
});

describe("coldVulnerable", () => {
  it("counts only active/nursing newborns inside the window", () => {
    const animals = [
      animal({ id: "k1", date_of_birth: daysAgo(2), status: "active" }),
      animal({ id: "k2", date_of_birth: daysAgo(20), status: "active" }),
      animal({ id: "k3", date_of_birth: daysAgo(2), status: "sold" }),
      animal({ id: "k4", date_of_birth: null, status: "active" }),
    ];
    const { newbornCount } = coldVulnerable(animals, NOW);
    expect(newbornCount).toBe(1);
  });
});

describe("hasPregnantAnimals", () => {
  it("detects confirmed and suspected pregnancies", () => {
    expect(hasPregnantAnimals([animal({ breeding_status: "confirmed_pregnant" })])).toBe(true);
    expect(hasPregnantAnimals([animal({ breeding_status: "suspected_pregnant" })])).toBe(true);
    expect(hasPregnantAnimals([animal({ breeding_status: "open" })])).toBe(false);
    expect(hasPregnantAnimals([animal()])).toBe(false);
  });
});
