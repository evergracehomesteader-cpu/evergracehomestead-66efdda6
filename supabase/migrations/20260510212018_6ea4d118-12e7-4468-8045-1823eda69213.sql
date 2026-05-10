-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  category TEXT NOT NULL DEFAULT 'general',
  link_type TEXT,
  link_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_all_auth ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Animal events (unified timeline)
CREATE TABLE public.animal_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  details JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.animal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY animal_events_all_auth ON public.animal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_animal_events_animal ON public.animal_events(animal_id, event_date DESC);

-- Income entries
CREATE TABLE public.income_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sale',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  link_type TEXT,
  link_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY income_entries_all_auth ON public.income_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Animals: pen tracking
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS current_pen TEXT;

-- Garden: watering tracking
ALTER TABLE public.garden_plots ADD COLUMN IF NOT EXISTS last_watered_on DATE;
ALTER TABLE public.garden_plots ADD COLUMN IF NOT EXISTS watering_interval_days INTEGER;