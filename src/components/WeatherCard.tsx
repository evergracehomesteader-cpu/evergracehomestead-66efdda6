import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHomesteadWeather } from "@/lib/use-homestead-weather";
import { relativeTime } from "@/lib/weather-cache";
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
  Wind,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

function weatherIcon(code: number, isDay: boolean): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon;
  if (code === 1) return isDay ? CloudSun : Cloud;
  if (code === 2) return isDay ? CloudSun : Cloud;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Storms";
  return "—";
}

const round = (n: number) => Math.round(n);

export function WeatherCard() {
  // Shared hook: same forecast the alerts surface uses, with an offline
  // fallback to the last cached fetch. The old inline freeze banner was
  // removed — the WeatherAlerts component below this card owns all alerts now.
  const { data, isLoading, isError, isStale, fetchedAt } = useHomesteadWeather();

  if (isLoading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Checking the sky over the homestead…</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Weather isn't available right now — check your connection and it'll retry.
        </p>
      </Card>
    );
  }

  const { current, daily } = data;
  const isDay = current.is_day === 1;
  const MainIcon = weatherIcon(current.weather_code, isDay);
  const todayHigh = round(daily.temperature_2m_max[0]);
  const todayLow = round(daily.temperature_2m_min[0]);
  const rainChance = daily.precipitation_probability_max[0] ?? 0;

  const dayNames = daily.time.map((t, i) => {
    if (i === 0) return "Today";
    return new Date(`${t}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
  });

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <MainIcon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Homestead weather</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {isStale && fetchedAt
            ? `Offline — last update ${relativeTime(fetchedAt.toISOString())}`
            : "Protem, MO"}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <MainIcon className="h-10 w-10 text-primary" />
          <div>
            <div className="text-3xl font-display font-semibold">
              {round(current.temperature_2m)}°F
            </div>
            <div className="text-xs text-muted-foreground">
              {weatherLabel(current.weather_code)}
            </div>
          </div>
        </div>
        <div className="ml-auto grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Thermometer className="h-3 w-3" /> Feels {round(current.apparent_temperature)}°
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Droplets className="h-3 w-3" /> {current.relative_humidity_2m}% humidity
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Wind className="h-3 w-3" /> {round(current.wind_speed_10m)} mph
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <CloudRain className="h-3 w-3" /> {rainChance}% rain today
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {dayNames.map((name, i) => {
          const Icon = weatherIcon(daily.weather_code[i], true);
          const min = round(daily.temperature_2m_min[i]);
          const pop = daily.precipitation_probability_max[i] ?? 0;
          return (
            <div key={name} className="rounded-lg border bg-card p-2.5 text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {name}
              </div>
              <Icon className="h-5 w-5 mx-auto my-1.5 text-primary" />
              <div className="text-sm font-semibold">
                {round(daily.temperature_2m_max[i])}°{" "}
                <span className="text-muted-foreground font-normal">{min}°</span>
              </div>
              {pop > 20 && (
                <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                  {pop}% rain
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        High {todayHigh}° / low {todayLow}° today at the homestead. Free, no account needed.
      </p>
    </Card>
  );
}
