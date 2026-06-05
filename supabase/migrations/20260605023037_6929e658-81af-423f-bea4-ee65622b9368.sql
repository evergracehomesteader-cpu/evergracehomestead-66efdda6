
-- Extend pregnancies with breeding method/evidence and birth detail
ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS breeding_method text NOT NULL DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS male_born integer,
  ADD COLUMN IF NOT EXISTS female_born integer,
  ADD COLUMN IF NOT EXISTS stillborn_count integer;

-- Track current reproductive status on the animal itself (mammal or bird)
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS breeding_status text;

-- Incubations for birds
CREATE TABLE IF NOT EXISTS public.incubations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid,
  species text NOT NULL,
  set_date date NOT NULL DEFAULT CURRENT_DATE,
  egg_count integer NOT NULL DEFAULT 0,
  fertile boolean,
  expected_hatch date,
  actual_hatch date,
  hatched_count integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incubations TO authenticated;
GRANT ALL ON public.incubations TO service_role;

ALTER TABLE public.incubations ENABLE ROW LEVEL SECURITY;

CREATE POLICY incubations_all_auth ON public.incubations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER incubations_set_updated_at
  BEFORE UPDATE ON public.incubations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
