// Beginner-friendly livestock terminology + life stage rules.
// Reads from species_catalog seeded in the DB.

export type SpeciesRow = {
  id: string;
  name: string;
  breeding_age_male_months: number | null;
  breeding_age_female_months: number | null;
  gestation_days: number | null;
  baby_term: string | null;
  juvenile_term: string | null;
  adult_male_term: string | null;
  adult_female_term: string | null;
  female_with_babies_term: string | null;
  baby_to_juvenile_age_months: number | null;
  juvenile_to_adult_age_months: number | null;
};

export type LifeStage = "baby" | "juvenile" | "adult" | "unknown";

export function ageInMonths(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
}

export function computeLifeStage(species: SpeciesRow | undefined, birthdate: string | null | undefined): LifeStage {
  const months = ageInMonths(birthdate);
  if (months == null || !species) return "unknown";
  const babyMax = species.baby_to_juvenile_age_months ?? 3;
  const juvMax = species.juvenile_to_adult_age_months ?? 8;
  if (months < babyMax) return "baby";
  if (months < juvMax) return "juvenile";
  return "adult";
}

export function displayTerm(
  species: SpeciesRow | undefined,
  stage: LifeStage,
  sex: "male" | "female" | "unknown",
  hasBabies = false,
): string {
  if (!species) return "Animal";
  if (stage === "baby") return species.baby_term ?? "Baby";
  if (stage === "juvenile") return species.juvenile_term ?? "Young";
  if (hasBabies && sex === "female") return species.female_with_babies_term ?? species.adult_female_term ?? "Adult";
  if (sex === "male") return species.adult_male_term ?? "Adult Male";
  if (sex === "female") return species.adult_female_term ?? "Adult Female";
  return "Adult";
}

export function isBreedingAge(
  species: SpeciesRow | undefined,
  sex: "male" | "female" | "unknown",
  birthdate: string | null | undefined,
): boolean {
  const months = ageInMonths(birthdate);
  if (months == null || !species) return false;
  const min = sex === "male" ? species.breeding_age_male_months : species.breeding_age_female_months;
  return min != null && months >= min;
}

export const ANIMAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending_sale", label: "Pending Sale" },
  { value: "sold", label: "Sold" },
  { value: "retired", label: "Retired" },
  { value: "deceased", label: "Deceased" },
  { value: "breeding", label: "Breeding" },
  { value: "pregnant", label: "Pregnant" },
  { value: "grow_out", label: "Grow Out" },
  { value: "butcher_planned", label: "Butcher Planned" },
  { value: "butchered", label: "Butchered" },
  { value: "medical_hold", label: "Medical Hold" },
  { value: "quarantine", label: "Quarantine" },
  { value: "pet", label: "Pet" },
  { value: "missing", label: "Missing" },
  { value: "archived", label: "Archived" },
];

export const BREED_TYPE_OPTIONS = [
  { value: "purebred", label: "Purebred" },
  { value: "cross", label: "Cross" },
  { value: "unknown", label: "Unknown" },
];

export const INTACT_MALE_OPTIONS = [
  { value: "yes", label: "Yes — has testicles (intact)" },
  { value: "no", label: "No — castrated/neutered" },
  { value: "unknown", label: "Unknown" },
];
