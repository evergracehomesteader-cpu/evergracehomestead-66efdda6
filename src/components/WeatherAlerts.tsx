// In-app weather alerts for the homestead, tied to the actual animals.
//
// Rendered on the dashboard right under the weather card. No push
// notifications — the app has no infra for that — so this is the surface:
// severity-ranked banners with plain-language "what to do" guidance,
// computed from the cached forecast so they work offline too.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useHomesteadWeather } from "@/lib/use-homestead-weather";
import { relativeTime } from "@/lib/weather-cache";
import {
  computeWeatherAlerts,
  type AlertAnimal,
  type AlertKind,
  type AlertSeverity,
  type ForecastDay,
} from "@/lib/weather-alerts";
import {
  Baby,
  CloudLightning,
  Snowflake,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from "lucide-react";

const KIND_ICON: Record<AlertKind, LucideIcon> = {
  "newborn-cold": Baby,
  freeze: Snowflake,
  heat: ThermometerSun,
  storm: CloudLightning,
  wind: Wind,
};

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-warning/50 bg-warning/5",
  watch: "border-primary/30 bg-primary/5",
};

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  critical: "text-destructive",
  warning: "text-warning",
  watch: "text-primary",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  watch: "Watch",
};

function toForecastDays(daily: {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
}): ForecastDay[] {
  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    apparentMax: daily.apparent_temperature_max[i] ?? daily.temperature_2m_max[i],
    weatherCode: daily.weather_code[i],
    precipProbMax: daily.precipitation_probability_max[i] ?? 0,
    windSpeedMax: daily.wind_speed_10m_max[i] ?? 0,
  }));
}

export function WeatherAlerts() {
  const { data, isStale, fetchedAt } = useHomesteadWeather();

  // Animals go through the offline-capable client, so this works from the
  // Dexie mirror when there's no signal.
  const animalsQuery = useQuery({
    queryKey: ["weather-alert-animals"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AlertAnimal[]> => {
      const { data } =
        await supabase
          .from("animals")
          .select("id,name,species,status,date_of_birth,breeding_status")
          .in("status", ["active", "nursing"]);
      return (data ?? []) as AlertAnimal[];
    },
  });

  // No forecast at all (offline cold start with empty cache): the weather
  // card shows its own error state, so stay quiet here.
  if (!data) return null;

  const alerts = computeWeatherAlerts(
    toForecastDays(data.daily),
    animalsQuery.data ?? []
  );
  if (alerts.length === 0) return null;

  return (
    <section aria-label="Weather alerts" className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Weather alerts</h3>
        {fetchedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {isStale
              ? `Offline — based on last update ${relativeTime(fetchedAt.toISOString())}`
              : `Updated ${relativeTime(fetchedAt.toISOString())}`}
          </span>
        )}
      </div>
      {alerts.map((alert) => {
        const Icon = KIND_ICON[alert.kind];
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-2.5 rounded-lg border p-3 ${SEVERITY_STYLE[alert.severity]}`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_ICON[alert.severity]}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {alert.title}
                <span
                  className={`ml-2 text-[10px] uppercase tracking-wide font-medium ${SEVERITY_ICON[alert.severity]}`}
                >
                  {SEVERITY_LABEL[alert.severity]}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
