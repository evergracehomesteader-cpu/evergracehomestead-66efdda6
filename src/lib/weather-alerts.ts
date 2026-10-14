// Animal-aware weather alerts, computed from the Open-Meteo forecast.
//
// All thresholds are in °F / mph and documented below. They were chosen for a
// Missouri homestead with goats (newborn kids are the critical cold case),
// pigs, and dogs — not for row crops or adult cattle. If the herd changes,
// retune here; the UI reads only what this module returns.
//
// Design notes:
//   - Pure functions only (no fetch, no React) so the threshold logic is unit
//     testable. See src/lib/__tests__/weather-alerts.test.ts.
//   - At most one alert per kind across the forecast window, referencing the
//     worst day — a 3-day cold snap should produce one freeze alert, not three.
//   - Alert copy is plain-language "what to do", written for Yuriza.

export type AlertSeverity = "critical" | "warning" | "watch";
export type AlertKind = "newborn-cold" | "freeze" | "heat" | "storm" | "wind";

export interface ForecastDay {
  /** ISO date yyyy-mm-dd */
  date: string;
  /** °F */
  tempMax: number;
  /** °F */
  tempMin: number;
  /** °F, feels-like max (heat index / wind chill blended by Open-Meteo) */
  apparentMax: number;
  /** WMO weather code */
  weatherCode: number;
  /** % */
  precipProbMax: number;
  /** mph */
  windSpeedMax: number;
}

export interface AlertAnimal {
  id: string;
  name: string;
  species: string | null;
  status: string | null;
  date_of_birth: string | null;
  breeding_status: string | null;
}

export interface WeatherAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  /** Plain-language guidance: what to do. */
  detail: string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Newborns (see NEWBORN_DAYS) + a night at/below this → critical: bring them in. */
export const NEWBORN_COLD_F = 40;
/** Night at/below this → critical hard-freeze alert for all stock. */
export const FREEZE_F = 32;
/** Night at/below this → watch-level freeze risk (matches the weather card's existing banner). */
export const FREEZE_RISK_F = 36;
/** Feels-like at/above this → critical heat alert. */
export const HEAT_CRITICAL_F = 100;
/** Feels-like at/above this → watch-level heat alert. */
export const HEAT_WATCH_F = 95;
/** WMO thunderstorm codes start at 95. */
const STORM_CODE_MIN = 95;
/** Storm alert needs this precipitation probability to avoid crying wolf on dry lightning codes. */
const STORM_POP_PCT = 40;
/** Sustained wind max at/above this → wind alert. */
const WIND_ALERT_MPH = 40;
/** Animals younger than this (days) count as newborns for cold escalation. */
export const NEWBORN_DAYS = 14;

const PREGNANT_STATUSES = new Set([
  "confirmed_pregnant",
  "suspected_pregnant",
  "exposed",
]);

const YOUNG_LABELS: Record<string, string> = {
  goat: "kids",
  sheep: "lambs",
  pig: "piglets",
  cattle: "calves",
  cow: "calves",
  dog: "puppies",
  chicken: "chicks",
};

function youngLabel(species: string | null): string {
  if (!species) return "young";
  return YOUNG_LABELS[species.toLowerCase().trim()] ?? "young";
}

/** Parse a yyyy-mm-dd date as a local date (matches the app's date convention). */
function parseLocalDate(d: string): Date {
  return new Date(`${d}T12:00:00`);
}

function daysOld(birthDate: string, now: Date): number {
  const ms = now.getTime() - parseLocalDate(birthDate).getTime();
  return Math.floor(ms / 86_400_000);
}

/** Short day label: "tonight"/"today" for index 0, weekday otherwise. */
function dayLabel(index: number, date: string, night: boolean): string {
  if (index === 0) return night ? "tonight" : "today";
  return parseLocalDate(date).toLocaleDateString("en-US", { weekday: "short" });
}

export interface ColdVulnerable {
  newbornCount: number;
  newbornLabel: string;
}

export function coldVulnerable(animals: AlertAnimal[], now: Date = new Date()): ColdVulnerable {
  const newborns = animals.filter(
    (a) =>
      (a.status === "active" || a.status === "nursing") &&
      a.date_of_birth &&
      daysOld(a.date_of_birth, now) >= 0 &&
      daysOld(a.date_of_birth, now) < NEWBORN_DAYS
  );
  // Group by species for copy like "3 goat kids and 2 piglets".
  const bySpecies = new Map<string, number>();
  for (const n of newborns) {
    const key = (n.species ?? "").toLowerCase().trim() || "unknown";
    bySpecies.set(key, (bySpecies.get(key) ?? 0) + 1);
  }
  const parts = [...bySpecies.entries()].map(
    ([sp, count]) => `${count} ${youngLabel(sp === "unknown" ? null : sp)}`
  );
  return { newbornCount: newborns.length, newbornLabel: parts.join(" and ") };
}

export function hasPregnantAnimals(animals: AlertAnimal[]): boolean {
  return animals.some((a) => a.breeding_status && PREGNANT_STATUSES.has(a.breeding_status));
}

/**
 * Compute weather alerts for the forecast window. Returns at most one alert
 * per kind, ordered most-severe first. `now` is injectable for tests.
 */
export function computeWeatherAlerts(
  days: ForecastDay[],
  animals: AlertAnimal[],
  now: Date = new Date()
): WeatherAlert[] {
  if (days.length === 0) return [];
  const alerts: WeatherAlert[] = [];
  const { newbornCount, newbornLabel } = coldVulnerable(animals, now);
  const pregnant = hasPregnantAnimals(animals);

  // ---- Cold: find the coldest night in the window ----
  let coldestIdx = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i].tempMin < days[coldestIdx].tempMin) coldestIdx = i;
  }
  const coldest = days[coldestIdx];
  const coldDay = dayLabel(coldestIdx, coldest.date, true);

  if (newbornCount > 0 && coldest.tempMin <= NEWBORN_COLD_F) {
    alerts.push({
      id: `newborn-cold-${coldest.date}`,
      kind: "newborn-cold",
      severity: "critical",
      title: "Cold + newborns — bring them in",
      detail:
        `Lows near ${Math.round(coldest.tempMin)}°F ${coldDay} with ` +
        `${newbornLabel} under ${NEWBORN_DAYS} days old on the ground. ` +
        `Newborns can't regulate body heat — get them into the shelter tonight ` +
        `with deep dry bedding, and check them again before bed.`,
    });
  }
  if (coldest.tempMin <= FREEZE_F) {
    alerts.push({
      id: `freeze-${coldest.date}`,
      kind: "freeze",
      severity: "critical",
      title: "Hard freeze coming",
      detail:
        `Lows near ${Math.round(coldest.tempMin)}°F ${coldDay}. Water will ice over — ` +
        `break ice morning and night, lock the herd in warm with deep bedding, ` +
        `and keep feed pans under cover.`,
    });
  } else if (coldest.tempMin <= FREEZE_RISK_F) {
    alerts.push({
      id: `freeze-risk-${coldest.date}`,
      kind: "freeze",
      severity: "watch",
      title: "Near-freezing night",
      detail:
        `Lows near ${Math.round(coldest.tempMin)}°F ${coldDay}. Toss extra bedding ` +
        `in the shelter and make sure water isn't already skinning over.`,
    });
  }

  // ---- Heat: hottest feels-like in the window ----
  let hottestIdx = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i].apparentMax > days[hottestIdx].apparentMax) hottestIdx = i;
  }
  const hottest = days[hottestIdx];
  const heatDay = dayLabel(hottestIdx, hottest.date, false);
  const heatNote = pregnant
    ? ` Watch pregnant and nursing animals for heavy open-mouth panting — heat can slow labor and dry up milk.`
    : ``;
  if (hottest.apparentMax >= HEAT_CRITICAL_F) {
    alerts.push({
      id: `heat-${hottest.date}`,
      kind: "heat",
      severity: "critical",
      title: "Dangerous heat",
      detail:
        `Feels like ${Math.round(hottest.apparentMax)}°F ${heatDay}. Cold fresh water ` +
        `in the shade for everyone, and don't work animals in the afternoon.${heatNote}`,
    });
  } else if (hottest.apparentMax >= HEAT_WATCH_F) {
    alerts.push({
      id: `heat-watch-${hottest.date}`,
      kind: "heat",
      severity: "watch",
      title: "Hot day ahead",
      detail:
        `Feels like ${Math.round(hottest.apparentMax)}°F ${heatDay}. Keep water topped ` +
        `up and make sure there's shade to get under.${heatNote}`,
    });
  }

  // ---- Storms: first stormy day in the window ----
  const stormIdx = days.findIndex(
    (d) => d.weatherCode >= STORM_CODE_MIN && d.precipProbMax >= STORM_POP_PCT
  );
  if (stormIdx >= 0) {
    const s = days[stormIdx];
    const stormDay = dayLabel(stormIdx, s.date, false);
    alerts.push({
      id: `storm-${s.date}`,
      kind: "storm",
      severity: "warning",
      title: "Storms on the way",
      detail:
        `${s.precipProbMax}% chance of thunderstorms ${stormDay}. Get animals under ` +
        `the shelter roof before it hits — a doe in labor or newborn kids should ` +
        `not be out in hail — and tie down tarps and feed pans.`,
    });
  }

  // ---- Wind: windiest day in the window ----
  let windyIdx = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i].windSpeedMax > days[windyIdx].windSpeedMax) windyIdx = i;
  }
  const windy = days[windyIdx];
  if (windy.windSpeedMax >= WIND_ALERT_MPH) {
    const windDay = dayLabel(windyIdx, windy.date, false);
    alerts.push({
      id: `wind-${windy.date}`,
      kind: "wind",
      severity: "warning",
      title: "High wind",
      detail:
        `Winds near ${Math.round(windy.windSpeedMax)} mph ${windDay}. Secure anything ` +
        `that can blow — tarps, feed pans, loose panels — and check fence lines after.`,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, watch: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
