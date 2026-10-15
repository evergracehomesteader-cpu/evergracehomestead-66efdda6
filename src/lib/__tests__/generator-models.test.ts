import { describe, expect, it } from "vitest";
import {
  GENERATOR_MODELS,
  findGeneratorModel,
  searchGeneratorModels,
  generatorModelLabel,
} from "../generator-models";

describe("GENERATOR_MODELS", () => {
  it("derives est_burn_gph as tank_gal / runtime_hrs for every model", () => {
    for (const m of GENERATOR_MODELS) {
      const expected = Math.round((m.tank_gal / m.runtime_hrs) * 100) / 100;
      expect(m.est_burn_gph).toBe(expected);
    }
  });

  it("contains the six required models with the expected burn estimates", () => {
    const byId = Object.fromEntries(GENERATOR_MODELS.map((m) => [m.id, m]));
    expect(byId["wen-gn5600m"].est_burn_gph).toBe(0.35);
    expect(byId["predator-3500"].est_burn_gph).toBe(0.21);
    expect(byId["honda-eu2200i"].est_burn_gph).toBe(0.12);
    expect(byId["champion-3800"].est_burn_gph).toBe(0.38);
    expect(byId["generac-gp6500"].est_burn_gph).toBe(0.63);
    expect(byId["westinghouse-wgen3600"].est_burn_gph).toBe(0.22);
  });

  it("has unique ids", () => {
    const ids = GENERATOR_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findGeneratorModel", () => {
  it("finds a model by id", () => {
    expect(findGeneratorModel("wen-gn5600m")?.model).toBe("GN5600M");
  });
  it("returns undefined for an unknown id", () => {
    expect(findGeneratorModel("nope")).toBeUndefined();
  });
});

describe("searchGeneratorModels", () => {
  it("returns all models on empty query", () => {
    expect(searchGeneratorModels("")).toHaveLength(GENERATOR_MODELS.length);
    expect(searchGeneratorModels("   ")).toHaveLength(GENERATOR_MODELS.length);
  });
  it("matches brand case-insensitively", () => {
    const ids = searchGeneratorModels("wEn").map((m) => m.id);
    expect(ids).toContain("wen-gn5600m");
  });
  it("matches model name", () => {
    const ids = searchGeneratorModels("eu2200").map((m) => m.id);
    expect(ids).toEqual(["honda-eu2200i"]);
  });
  it("returns empty for no match", () => {
    expect(searchGeneratorModels("zzzz")).toEqual([]);
  });
});

describe("generatorModelLabel", () => {
  it("formats brand, model, and watts", () => {
    const m = findGeneratorModel("generac-gp6500")!;
    expect(generatorModelLabel(m)).toBe("Generac GP6500 · 6500W");
  });
});
