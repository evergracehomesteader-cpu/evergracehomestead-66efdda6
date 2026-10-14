-- =========================================================================
-- Power section: generator + propane tracking for off-grid homesteads
-- =========================================================================
-- Four tables, all homestead-scoped like the rest of the app:
--   power_generators      — generator profiles (mutable entity)
--   power_generator_logs  — append-only log: fuel adds, runtime, maintenance
--   power_propane_tanks   — propane tank profiles (mutable entity)
--   power_propane_logs    — append-only log: refills, level checks
--
-- IMPORTANT DEPLOY NOTE: apply this migration to Supabase BEFORE publishing
-- the app build that syncs these tables. The offline sync engine pulls every
-- synced table on start; if the tables don't exist server-side yet, the whole
-- sync cycle errors instead of syncing the other tables.

-- Generator profiles -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.power_generators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  name text NOT NULL,
  fuel_type text NOT NULL DEFAULT 'gasoline',
  tank_capacity_gal numeric NOT NULL DEFAULT 0,
  burn_rate_gph numeric NOT NULL DEFAULT 0.75,
  current_fuel_gal numeric NOT NULL DEFAULT 0,
  total_runtime_hrs numeric NOT NULL DEFAULT 0,
  oil_change_interval_hrs numeric NOT NULL DEFAULT 100,
  last_maintenance_type text,
  last_maintenance_at timestamptz,
  last_maintenance_hrs numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS power_generators_homestead_idx ON public.power_generators(homestead_id);
DROP TRIGGER IF EXISTS power_generators_updated ON public.power_generators;
CREATE TRIGGER power_generators_updated BEFORE UPDATE ON public.power_generators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generator log (append-only) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.power_generator_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  generator_id uuid NOT NULL REFERENCES public.power_generators(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  fuel_gallons numeric,
  fuel_cost_cents integer,
  runtime_hours numeric,
  maintenance_type text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS power_generator_logs_gen_idx ON public.power_generator_logs(generator_id);
CREATE INDEX IF NOT EXISTS power_generator_logs_date_idx ON public.power_generator_logs(logged_at DESC);

-- Propane tank profiles -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.power_propane_tanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity_gal numeric NOT NULL DEFAULT 0,
  current_level_pct numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS power_propane_tanks_homestead_idx ON public.power_propane_tanks(homestead_id);
DROP TRIGGER IF EXISTS power_propane_tanks_updated ON public.power_propane_tanks;
CREATE TRIGGER power_propane_tanks_updated BEFORE UPDATE ON public.power_propane_tanks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Propane log (append-only) --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.power_propane_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  tank_id uuid NOT NULL REFERENCES public.power_propane_tanks(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  level_pct numeric,
  gallons numeric,
  cost_cents integer,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS power_propane_logs_tank_idx ON public.power_propane_logs(tank_id);
CREATE INDEX IF NOT EXISTS power_propane_logs_date_idx ON public.power_propane_logs(logged_at DESC);

-- Homestead defaults (so client inserts don't need to specify homestead_id) --
DO $$
DECLARE
  tbls text[] := ARRAY[
    'power_generators','power_generator_logs',
    'power_propane_tanks','power_propane_logs'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN homestead_id SET DEFAULT public.current_homestead_id()', t);
  END LOOP;
END $$;

-- Grants + RLS (role-gated, same as the other data tables) -------------------
DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'power_generators','power_generator_logs',
    'power_propane_tanks','power_propane_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()))',
      t || '_select_approved', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()))',
      t || '_insert_writer', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_write_data(auth.uid())) WITH CHECK (public.can_write_data(auth.uid()))',
      t || '_update_writer', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_write_data(auth.uid()))',
      t || '_delete_writer', t);
  END LOOP;
END $$;
