-- Phase 3 schema additions

-- Animals: purchase tracking
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS purchase_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_date date;

-- Pregnancies: breeding cost
ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS breeding_cost_cents integer NOT NULL DEFAULT 0;

-- Contacts directory (vet, breeder, buyer, etc.)
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'other',
  phone text,
  email text,
  location text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_all_auth ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER contacts_set_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Health records: vaccination, deworming, treatment, injury, illness, vet visit, body condition
CREATE TABLE IF NOT EXISTS public.health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL,
  record_type text NOT NULL DEFAULT 'treatment',
  product text,
  dosage text,
  administered_on date NOT NULL DEFAULT CURRENT_DATE,
  withdrawal_meat_until date,
  withdrawal_milk_until date,
  withdrawal_eggs_until date,
  contact_id uuid,
  vet_contact text,
  cost_cents integer NOT NULL DEFAULT 0,
  body_condition_score numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_records_all_auth ON public.health_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER health_records_set_updated BEFORE UPDATE ON public.health_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS health_records_animal_idx ON public.health_records(animal_id);

-- Production logs: eggs, milk, meat, offspring, harvest, compost
CREATE TABLE IF NOT EXISTS public.production_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid,
  group_label text,
  product_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'ea',
  produced_on date NOT NULL DEFAULT CURRENT_DATE,
  value_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_logs_all_auth ON public.production_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS production_logs_animal_idx ON public.production_logs(animal_id);
CREATE INDEX IF NOT EXISTS production_logs_date_idx ON public.production_logs(produced_on);

-- Breeding decisions: keep / breed / sell / butcher
CREATE TABLE IF NOT EXISTS public.breeding_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL,
  decision text NOT NULL DEFAULT 'keep',
  target_date date,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.breeding_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY breeding_decisions_all_auth ON public.breeding_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER breeding_decisions_set_updated BEFORE UPDATE ON public.breeding_decisions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS breeding_decisions_animal_idx ON public.breeding_decisions(animal_id);