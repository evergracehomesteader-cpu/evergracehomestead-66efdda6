// Default gestation lengths in days, keyed by lowercase species name.
export const GESTATION_DAYS: Record<string, number> = {
  pig: 114,
  goat: 150,
  sheep: 147,
  dog: 63,
  cat: 65,
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

// Default nursing/weaning duration in days, keyed by lowercase canonical species.
// Birds are intentionally omitted — they don't nurse. Goat is editable in UI.
export const WEANING_DAYS: Record<string, number> = {
  pig: 56,
  cat: 56,
  dog: 56,
  goat: 84,
  sheep: 60,
  rabbit: 42,
  cow: 210,
};

export function weaningDaysFor(species?: string | null): number | null {
  if (!species) return null;
  let s = species.toLowerCase().trim();
  if (s === "cattle") s = "cow";
  else if (s === "geese") s = "goose";
  else if (s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (BIRD_SPECIES.has(s)) return null;
  return WEANING_DAYS[s] ?? 56;
}

// Normalize species names like "Pigs", "Goats", "Cattle" to canonical keys.
function normalizeSpecies(species?: string | null): string {
  if (!species) return "";
  let s = species.toLowerCase().trim();
  // Strip trailing plural "s" (Pigs -> pig, Goats -> goat, Cows -> cow, Ducks -> duck).
  // Special cases:
  if (s === "cattle") return "cow";
  if (s === "sheep") return "sheep"; // already singular/plural same
  if (s === "geese") return "goose";
  if (s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

export function isBird(species?: string | null): boolean {
  const s = normalizeSpecies(species);
  if (!s) return false;
  return BIRD_SPECIES.has(s);
}

export function gestationFor(species?: string | null): number {
  const s = normalizeSpecies(species);
  if (!s) return 150;
  return GESTATION_DAYS[s] ?? 150;
}

export function incubationFor(species?: string | null): number {
  const s = normalizeSpecies(species);
  if (!s) return 21;
  return INCUBATION_DAYS[s] ?? 21;
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
