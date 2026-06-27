
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_approved_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role <> 'pending'::app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_data(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin'::app_role,'manager'::app_role,'animal_care'::app_role,'helper'::app_role,'bookkeeper'::app_role)
  )
$$;

-- Lock down EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_data(uuid) TO authenticated;

-- Replace permissive policies with role-gated ones for sensitive data tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'animals','animal_events','health_records','feed_logs','feed_purchases',
    'income_entries','bills','litters','pregnancies','weight_logs',
    'production_logs','barter_deals','contacts','tasks','heat_events',
    'breeding_decisions','barter_contacts','barter_items','garden_plots',
    'compost_entries','incubations'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
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
    END IF;
  END LOOP;
END $$;
