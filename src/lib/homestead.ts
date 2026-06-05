// Default gestation lengths in days, keyed by lowercase species name.
export const GESTATION_DAYS: Record<string, number> = {
  pig: 114,
  goat: 150,
  sheep: 147,
  dog: 63,
  cat: 63,
  rabbit: 31,
  cow: 283,
  horse: 340,
};

// Bird incubation lengths in days.
export const INCUBATION_DAYS: Record<string, number> = {
  chicken: 21,
  duck: 28,
  goose: 30,
  turkey: 28,
  "guinea fowl": 26,
  guinea: 26,
  quail: 17,
};

export const BIRD_SPECIES = new Set(Object.keys(INCUBATION_DAYS));

export function isBird(species?: string | null): boolean {
  if (!species) return false;
  return BIRD_SPECIES.has(species.toLowerCase());
}

export function gestationFor(species?: string | null): number {
  if (!species) return 150;
  return GESTATION_DAYS[species.toLowerCase()] ?? 150;
}

export function incubationFor(species?: string | null): number {
  if (!species) return 21;
  return INCUBATION_DAYS[species.toLowerCase()] ?? 21;
}

export const MAMMAL_BREEDING_STATUSES = [
  "open",
  "exposed",
  "suspected_pregnant",
  "confirmed_pregnant",
  "lactating",
  "recently_gave_birth",
] as const;

export const BIRD_BREEDING_STATUSES = [
  "layer",
  "broody",
  "incubating",
  "hatching",
  "molting",
] as const;

export const BREEDING_METHODS = ["natural", "ai"] as const;
export const BREEDING_EVIDENCE = ["observed_breeding", "standing_heat", "exposure_only", "other"] as const;

export function prettyStatus(s?: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ANIMAL_STATUSES = ["active", "sold", "butchered", "deceased", "missing", "archived"] as const;
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

export const PREGNANCY_STATUSES = ["suspected", "confirmed", "active", "delivered", "born", "lost"] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUSES)[number];

export const BILL_RECURRING = ["none", "weekly", "monthly", "quarterly", "yearly"] as const;

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "confirmed":
    case "confirmed_pregnant":
      return "bg-success text-success-foreground border-transparent";
    case "suspected":
    case "suspected_pregnant":
    case "exposed":
    case "pending":
    case "broody":
    case "incubating":
      return "bg-warning text-warning-foreground border-transparent";
    case "sold":
    case "archived":
    case "open":
    case "layer":
    case "molting":
      return "bg-secondary text-secondary-foreground border-transparent";
    case "butchered":
    case "deceased":
    case "lost":
    case "cancelled":
      return "bg-destructive text-destructive-foreground border-transparent";
    case "missing":
      return "bg-warning text-warning-foreground border-transparent";
    case "delivered":
    case "born":
    case "completed":
    case "hatching":
    case "lactating":
    case "recently_gave_birth":
      return "bg-success text-success-foreground border-transparent";
    default:
      return "";
  }
}
