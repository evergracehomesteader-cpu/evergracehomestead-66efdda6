// Shared homestead-weather data hook.
//
// One React Query entry point for the forecast so the weather card and the
// alerts surface share the same data (and the same network request). Adds the
// daily fields the alert logic needs (feels-like max, wind max) on top of what
// the card already fetched — additive only, card behavior unchanged.
//
// Offline behavior: every successful fetch is written to the localStorage
// cache; when the fetch fails (no signal), the last cached forecast is served
// instead, flagged with `isStale` so the UI can say "based on last update".

import { useQuery } from "@tanstack/react-query";
import { readWeatherCache, writeWeatherCache } from "@/lib/weather-cache";

// Heritage Bend Tract 33 homestead GPS (Protem, MO). Weather follows the homestead,
// not the phone's location, so it stays correct even when she's off the property.
export const HOMESTEAD_LAT = 36.52878;
export const HOMESTEAD_LON = -92.8847;

export interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
  };
}

async function fetchHomesteadWeather(): Promise<OpenMeteoResponse> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${HOMESTEAD_LAT}&longitude=${HOMESTEAD_LON}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;
  writeWeatherCache(data);
  return data;
}

export interface HomesteadWeather {
  data: OpenMeteoResponse | null;
  isLoading: boolean;
  isError: boolean;
  /** True when showing the cached forecast because the live fetch failed. */
  isStale: boolean;
  /** When the shown data was fetched (live or cached). */
  fetchedAt: Date | null;
}

export function useHomesteadWeather(): HomesteadWeather {
  const query = useQuery({
    queryKey: ["homestead-weather"],
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: fetchHomesteadWeather,
  });

  // React Query keeps the last good data in memory across mounts, so
  // `query.data` covers the online case. The localStorage cache covers a cold
  // start with no signal.
  const cached = query.data ? null : readWeatherCache<OpenMeteoResponse>();
  const data = query.data ?? cached?.data ?? null;
  const fetchedAt = query.data
    ? new Date(query.dataUpdatedAt)
    : cached
      ? new Date(cached.fetchedAt)
      : null;

  return {
    data,
    isLoading: query.isLoading && !cached,
    isError: query.isError && !cached,
    isStale: !query.data && !!cached,
    fetchedAt,
  };
}
