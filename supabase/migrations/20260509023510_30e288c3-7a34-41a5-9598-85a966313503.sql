-- Expand animal status
ALTER TYPE public.animal_status ADD VALUE IF NOT EXISTS 'butchered';
ALTER TYPE public.animal_status ADD VALUE IF NOT EXISTS 'missing';

-- Expand pregnancy status
ALTER TYPE public.pregnancy_status ADD VALUE IF NOT EXISTS 'suspected';
ALTER TYPE public.pregnancy_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.pregnancy_status ADD VALUE IF NOT EXISTS 'delivered';

-- Animal extras
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS temperament_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medical_notes TEXT;

-- Pregnancy: survived count
ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS survived_count INTEGER;

-- Feed extras
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS species_for TEXT,
  ADD COLUMN IF NOT EXISTS package_size NUMERIC;

-- Weight logs
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  weight NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lb',
  weighed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_animal ON public.weight_logs(animal_id);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY weight_logs_all_auth ON public.weight_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Animal photos bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('animal-photos', 'animal-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Animal photos viewable by all"
  ON storage.objects FOR SELECT USING (bucket_id = 'animal-photos');
CREATE POLICY "Auth users upload animal photos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'animal-photos');
CREATE POLICY "Auth users update animal photos"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'animal-photos');
CREATE POLICY "Auth users delete animal photos"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'animal-photos');