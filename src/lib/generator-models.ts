// Built-in portable generator model specs — bundled locally so the model
// picker works fully offline (no network calls).
//
// Each entry carries the manufacturer's advertised tank size and runtime,
// from which we derive an estimated burn rate (gal/hr) = tank_gal / runtime_hrs.
// The estimate is a starting point: once the user logs real fuel + runtime,
// the app shows their actual measured burn rate alongside it (see
// actualBurnRateGph in ./power).

export interface GeneratorModel {
  id: string;
  brand: string;
  model: string;
  rated_watts: number;
  fuel_type: string;
  tank_gal: number;
  /** Manufacturer-advertised runtime on one tank (hours). */
  runtime_hrs: number;
  /** Load the advertised runtime was measured at (e.g. "half load"). */
  runtime_load_note: string;
  /** Derived estimate: tank_gal / runtime_hrs, rounded to 2 decimals. */
  est_burn_gph: number;
}

const m = (
  id: string,
  brand: string,
  model: string,
  rated_watts: number,
  fuel_type: string,
  tank_gal: number,
  runtime_hrs: number,
  runtime_load_note: string,
): GeneratorModel => ({
  id,
  brand,
  model,
  rated_watts,
  fuel_type,
  tank_gal,
  runtime_hrs,
  runtime_load_note,
  est_burn_gph: Math.round((tank_gal / runtime_hrs) * 100) / 100,
});

export const GENERATOR_MODELS: GeneratorModel[] = [
  m("wen-gn5600m", "WEN", "GN5600M", 4500, "gasoline", 4.36, 12.5, "half load"),
  m("predator-3500", "Predator", "3500 Inverter", 3000, "gasoline", 2.3, 11, "25% load"),
  m("honda-eu2200i", "Honda", "EU2200i", 1800, "gasoline", 0.95, 8.1, "1/4 load (eco)"),
  m("champion-3800", "Champion", "3800-Watt (100522)", 3800, "gasoline", 3.4, 9, "half load"),
  m("generac-gp6500", "Generac", "GP6500", 6500, "gasoline", 6.6, 10.5, "half load"),
  m("westinghouse-wgen3600", "Westinghouse", "WGen3600", 3600, "gasoline", 4, 18, "25% load"),
  m("predator-2000", "Predator", "2000 Inverter", 1600, "gasoline", 1.2, 6.5, "half load"),
  m("westinghouse-igen4500", "Westinghouse", "iGen4500", 3700, "gasoline", 3.4, 18, "25% load"),
];

export function findGeneratorModel(id: string): GeneratorModel | undefined {
  return GENERATOR_MODELS.find((g) => g.id === id);
}

/** Case-insensitive search over brand + model name. Empty query returns all. */
export function searchGeneratorModels(query: string): GeneratorModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return GENERATOR_MODELS;
  return GENERATOR_MODELS.filter((g) =>
    `${g.brand} ${g.model}`.toLowerCase().includes(q),
  );
}

/** Display label, e.g. "WEN GN5600M · 4500W". */
export function generatorModelLabel(g: GeneratorModel): string {
  return `${g.brand} ${g.model} · ${g.rated_watts}W`;
}
