// localStorage cache for the homestead forecast.
//
// The forecast is cached on every successful fetch so weather alerts can be
// computed offline from the last good data. Reads never throw — a corrupt or
// missing cache just returns null.

export interface CachedForecast<T> {
  /** ISO timestamp of when the data was fetched. */
  fetchedAt: string;
  data: T;
}

const KEY = "homestead-weather-cache-v1";

export function readWeatherCache<T>(): CachedForecast<T> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedForecast<T>;
    if (!parsed || typeof parsed.fetchedAt !== "string" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWeatherCache<T>(data: T): void {
  try {
    const entry: CachedForecast<T> = { fetchedAt: new Date().toISOString(), data };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable (private mode) — the app still works, it
    // just won't have an offline forecast. Never break the UI over this.
  }
}

/** Short relative label like "5m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
