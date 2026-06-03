-- =========================================================
-- CHORES
-- =========================================================
CREATE TABLE public.chores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  notes text,
  category text NOT NULL DEFAULT 'general',
  recurrence text NOT NULL DEFAULT 'daily', -- daily | weekly | monthly | once
  days_of_week integer[] NOT NULL DEFAULT '{}', -- 0=Sun..6=Sat (used when recurrence='weekly')
  day_of_month integer, -- 1-31 (used when recurrence='monthly')
  due_time time, -- optional time of day
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date, -- optional end of recurrence
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chores TO authenticated;
GRANT ALL ON public.chores TO service_role;

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chores_select_auth" ON public.chores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chores_admin_manager_write" ON public.chores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER chores_set_updated_at
  BEFORE UPDATE ON public.chores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CHORE ASSIGNMENTS
-- =========================================================
CREATE TABLE public.chore_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chore_id uuid NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chore_id, user_id)
);

CREATE INDEX idx_chore_assignments_user ON public.chore_assignments(user_id);
CREATE INDEX idx_chore_assignments_chore ON public.chore_assignments(chore_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chore_assignments TO authenticated;
GRANT ALL ON public.chore_assignments TO service_role;

ALTER TABLE public.chore_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_assign_select_auth" ON public.chore_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chore_assign_admin_manager_write" ON public.chore_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- =========================================================
-- CHORE COMPLETIONS
-- =========================================================
CREATE TABLE public.chore_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chore_id uuid NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  instance_date date NOT NULL,
  completed_by uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (chore_id, instance_date)
);

CREATE INDEX idx_chore_completions_chore_date ON public.chore_completions(chore_id, instance_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chore_completions TO authenticated;
GRANT ALL ON public.chore_completions TO service_role;

ALTER TABLE public.chore_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_compl_select_auth" ON public.chore_completions
  FOR SELECT TO authenticated USING (true);

-- anyone signed in can mark complete; UI gates by permission/assignment
CREATE POLICY "chore_compl_insert_auth" ON public.chore_completions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "chore_compl_update_own_or_admin" ON public.chore_completions
  FOR UPDATE TO authenticated
  USING (completed_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (true);

CREATE POLICY "chore_compl_delete_own_or_admin" ON public.chore_completions
  FOR DELETE TO authenticated
  USING (completed_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- =========================================================
-- BACKUPS
-- =========================================================
CREATE TABLE public.backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  notes text,
  size_bytes bigint NOT NULL DEFAULT 0,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_path text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backups_created_at ON public.backups(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backups_admin_all" ON public.backups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- ROLE PERMISSION SEEDS (chores)
-- =========================================================
-- helper: view assigned + complete + add notes
INSERT INTO public.role_permissions (role, permission) VALUES
  ('helper'::app_role, 'chores.view'),
  ('helper'::app_role, 'chores.view.assigned'),
  ('helper'::app_role, 'chores.complete'),
  ('manager'::app_role, 'chores.view'),
  ('manager'::app_role, 'chores.create'),
  ('manager'::app_role, 'chores.edit'),
  ('manager'::app_role, 'chores.complete'),
  ('viewer'::app_role, 'chores.view'),
  ('animal_care'::app_role, 'chores.view'),
  ('animal_care'::app_role, 'chores.complete'),
  ('volunteer'::app_role, 'chores.view.assigned'),
  ('volunteer'::app_role, 'chores.complete')
ON CONFLICT DO NOTHING;
