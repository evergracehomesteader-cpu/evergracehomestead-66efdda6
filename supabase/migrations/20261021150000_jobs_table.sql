-- Jobs: a dead-simple job tracker + drywall estimator for the contractor
-- role (Aaron's business). Big-button page at /jobs; the page-level
-- permissions seeded below (jobs.view / jobs.create / jobs.edit) gate who
-- sees and uses it.
--
-- RLS approach: GRANT style mirrors the other homestead tables, and SELECT
-- uses public.is_homestead_member like every tenant table. Writes also use
-- is_homestead_member (member level) rather than the app-wide
-- public.can_write_homestead(...) helper: that helper's role list
-- ('admin','manager','animal_care','helper','bookkeeper') does NOT include
-- the new 'contractor' role, so mirroring it here would lock the contractor
-- out of saving his own jobs. Finer control lives in the page permissions.

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text,
  address text,
  job_title text,
  status text NOT NULL DEFAULT 'new',
  scheduled_date date,
  sqft numeric,
  hang boolean NOT NULL DEFAULT true,
  finish boolean NOT NULL DEFAULT true,
  hang_labor_rate numeric NOT NULL DEFAULT 0.75,
  finish_labor_rate numeric NOT NULL DEFAULT 1.25,
  materials_cost numeric NOT NULL DEFAULT 0,
  labor_hours numeric,
  labor_hourly_rate numeric,
  total numeric NOT NULL DEFAULT 0,
  deposit numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_hid_idx ON public.jobs(homestead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
  USING (public.is_homestead_member(homestead_id, auth.uid()));
CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_homestead_member(homestead_id, auth.uid()));
CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
  USING (public.is_homestead_member(homestead_id, auth.uid()))
  WITH CHECK (public.is_homestead_member(homestead_id, auth.uid()));
CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
  USING (public.is_homestead_member(homestead_id, auth.uid()));

-- Seed contractor role permissions (same INSERT style as the original seed
-- in 20260603113019; ON CONFLICT DO NOTHING because (role, permission) is
-- unique).
INSERT INTO public.role_permissions (role, permission) VALUES
  ('contractor','dashboard.view'),
  ('contractor','jobs.view'),
  ('contractor','jobs.create'),
  ('contractor','jobs.edit')
ON CONFLICT DO NOTHING;
