-- Add 'retired' status
ALTER TYPE animal_status ADD VALUE IF NOT EXISTS 'retired';

-- Expected sale price for projected income
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS expected_sale_price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS sale_price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS sale_date date;

-- Seed missing species (UI also offers "Other" as a free-text fallback)
INSERT INTO public.species_catalog (name, breeding_age_male_months, breeding_age_female_months, gestation_days, baby_term, juvenile_term, adult_male_term, adult_female_term, female_with_babies_term, baby_to_juvenile_age_months, juvenile_to_adult_age_months) VALUES
  ('Turkeys',  6, 6, 28, 'Poult',  'Jenny/Jake', 'Tom (Boy Turkey)',  'Hen (Momma Turkey)',  'Momma Hen',     2, 6),
  ('Cows',     12, 15, 283, 'Calf', 'Yearling',   'Bull (Boy Cow)',    'Cow (Momma Cow)',     'Momma Cow',     6, 15),
  ('Rabbits',  6, 6, 31,  'Kit',    'Junior',     'Buck (Boy Rabbit)', 'Doe (Momma Rabbit)',  'Momma Doe',     2, 6),
  ('Horses',   18, 18, 340,'Foal',  'Yearling',   'Stallion (Boy Horse)','Mare (Momma Horse)','Momma Mare',    6, 24),
  ('Sheep',    8, 8, 150, 'Lamb',   'Hogget',     'Ram (Boy Sheep)',   'Ewe (Momma Sheep)',   'Momma Ewe',     4, 12)
ON CONFLICT DO NOTHING;