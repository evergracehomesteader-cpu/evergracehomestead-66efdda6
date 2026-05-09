// Default gestation lengths in days, keyed by lowercase species name.
export const GESTATION_DAYS: Record<string, number> = {
  pig: 114,
  goat: 150,
  sheep: 147,
  chicken: 21,
  duck: 28,
  turkey: 28,
  dog: 63,
  cat: 63,
  rabbit: 31,
  cow: 283,
  horse: 340,
};

export function gestationFor(species?: string | null): number {
  if (!species) return 150;
  return GESTATION_DAYS[species.toLowerCase()] ?? 150;
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
      return "bg-success text-success-foreground border-transparent";
    case "suspected":
    case "pending":
      return "bg-warning text-warning-foreground border-transparent";
    case "sold":
    case "archived":
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
      return "bg-success text-success-foreground border-transparent";
    default:
      return "";
  }
}
