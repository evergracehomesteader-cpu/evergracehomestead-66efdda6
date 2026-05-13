
-- Phase 1: Animals & Breeding foundation

-- 1. Extend animal_status enum (additive — keeps existing values)
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'breeding';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'pregnant';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'grow_out';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'retained';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'pending_sale';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'pending_trade';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'butcher_planned';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'medical_hold';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'quarantine';
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'pet';

-- 2. Extend animals table (all additive, no data loss)
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS breed_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS secondary_breed text,
  ADD COLUMN IF NOT EXISTS breed_percentage text,
  ADD COLUMN IF NOT EXISTS breed_notes text,
  ADD COLUMN IF NOT EXISTS front_photo_url text,
  ADD COLUMN IF NOT EXISTS side_photo_url text,
  ADD COLUMN IF NOT EXISTS additional_photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_marking_description text,
  ADD COLUMN IF NOT EXISTS user_edited_description text,
  ADD COLUMN IF NOT EXISTS life_stage text,
  ADD COLUMN IF NOT EXISTS manual_life_stage_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_intact_male text NOT NULL DEFAULT 'unknown', -- 'yes' | 'no' | 'unknown'
  ADD COLUMN IF NOT EXISTS male_reproductive_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS castration_date date,
  ADD COLUMN IF NOT EXISTS testicle_status_notes text,
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'owned',
  ADD COLUMN IF NOT EXISTS temporary_record boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS litter_id uuid;

-- Backfill front_photo_url from legacy photo_url
UPDATE public.animals SET front_photo_url = photo_url WHERE front_photo_url IS NULL AND photo_url IS NOT NULL;

-- 3. Species catalog
CREATE TABLE IF NOT EXISTS public.species_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  breeding_age_male_months integer,
  breeding_age_female_months integer,
  gestation_days integer,
  baby_term text,
  juvenile_term text,
  adult_male_term text,
  adult_female_term text,
  female_with_babies_term text,
  baby_to_juvenile_age_months integer,
  juvenile_to_adult_age_months integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.species_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS species_catalog_all_auth ON public.species_catalog;
CREATE POLICY species_catalog_all_auth ON public.species_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Breeds catalog
CREATE TABLE IF NOT EXISTS public.breeds_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id uuid NOT NULL REFERENCES public.species_catalog(id) ON DELETE CASCADE,
  breed_name text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (species_id, breed_name)
);
ALTER TABLE public.breeds_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS breeds_catalog_all_auth ON public.breeds_catalog;
CREATE POLICY breeds_catalog_all_auth ON public.breeds_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Litters
CREATE TABLE IF NOT EXISTS public.litters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_id uuid,
  father_id uuid,
  birth_date date NOT NULL DEFAULT CURRENT_DATE,
  male_count integer NOT NULL DEFAULT 0,
  female_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.litters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS litters_all_auth ON public.litters;
CREATE POLICY litters_all_auth ON public.litters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Seed species + common breeds
INSERT INTO public.species_catalog (name, breeding_age_male_months, breeding_age_female_months, gestation_days, baby_term, juvenile_term, adult_male_term, adult_female_term, female_with_babies_term, baby_to_juvenile_age_months, juvenile_to_adult_age_months) VALUES
  ('Pigs',     6,  6,  114, 'Baby Pig (Piglet)',     'Young Pig (Grow Out)',         'Boy Pig (Boar)',         'Girl Pig (Sow)',         'Momma Pig (Sow)',     2,  6),
  ('Goats',    6,  7,  150, 'Baby Goat (Kid)',       'Young Goat',                   'Boy Goat (Buck)',        'Girl Goat (Doe)',        'Momma Goat (Doe)',    3,  8),
  ('Chickens', 5,  5,   21, 'Baby Chicken (Chick)',  'Young Chicken',                'Boy Chicken (Rooster)',  'Girl Chicken (Hen)',     'Momma Hen (Hen)',     2,  5),
  ('Ducks',    5,  5,   28, 'Baby Duck (Duckling)',  'Young Duck',                   'Boy Duck (Drake)',       'Girl Duck (Duck)',       'Momma Duck (Duck)',   2,  5),
  ('Dogs',    12, 12,   63, 'Puppy',                 'Young Dog',                    'Boy Dog',                'Girl Dog',               'Momma Dog',           4, 12),
  ('Cats',    10, 10,   63, 'Kitten',                'Young Cat',                    'Boy Cat',                'Girl Cat',               'Momma Cat',           4, 10)
ON CONFLICT (name) DO NOTHING;

-- 7. Seed common breeds per species
DO $$
DECLARE
  r record;
  breed text;
  breeds text[];
BEGIN
  FOR r IN SELECT id, name FROM public.species_catalog LOOP
    breeds := CASE r.name
      WHEN 'Pigs'     THEN ARRAY['Berkshire','IPP','Kunekune','Duroc','Hampshire','Yorkshire']
      WHEN 'Chickens' THEN ARRAY['Australorp','Rhode Island Red','Wyandotte','Marans','Easter Egger','Barred Rock','Cornish Cross']
      WHEN 'Goats'    THEN ARRAY['Nigerian Dwarf','Boer','Nubian','Kiko','Pygmy']
      WHEN 'Ducks'    THEN ARRAY['Rouen','Blue Swedish','Pekin','Khaki Campbell','Muscovy']
      WHEN 'Dogs'     THEN ARRAY['Pitbull','Catahoula','Beagle','Yorkie','Mixed Breed']
      WHEN 'Cats'     THEN ARRAY['Domestic Longhair','Domestic Shorthair','Siamese','Mixed Breed']
      ELSE ARRAY[]::text[]
    END;
    FOREACH breed IN ARRAY breeds LOOP
      INSERT INTO public.breeds_catalog (species_id, breed_name, is_custom)
      VALUES (r.id, breed, false)
      ON CONFLICT (species_id, breed_name) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 8. updated_at triggers
DROP TRIGGER IF EXISTS species_catalog_set_updated_at ON public.species_catalog;
CREATE TRIGGER species_catalog_set_updated_at BEFORE UPDATE ON public.species_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS litters_set_updated_at ON public.litters;
CREATE TRIGGER litters_set_updated_at BEFORE UPDATE ON public.litters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
