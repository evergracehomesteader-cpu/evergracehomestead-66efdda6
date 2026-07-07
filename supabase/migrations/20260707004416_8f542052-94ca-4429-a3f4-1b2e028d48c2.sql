
-- Track each user's current homestead so DB defaults can auto-populate homestead_id.
CREATE TABLE IF NOT EXISTS public.user_current_homestead (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_current_homestead TO authenticated;
GRANT ALL ON public.user_current_homestead TO service_role;
ALTER TABLE public.user_current_homestead ENABLE ROW LEVEL SECURITY;

CREATE POLICY uch_own ON public.user_current_homestead FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_homestead_member(homestead_id, auth.uid()));

-- Helper: return the user's current homestead, falling back to the first homestead they belong to.
CREATE OR REPLACE FUNCTION public.current_homestead_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT homestead_id FROM public.user_current_homestead WHERE user_id = auth.uid()),
    (SELECT homestead_id FROM public.homestead_members WHERE user_id = auth.uid()
       ORDER BY created_at ASC LIMIT 1)
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_homestead_id() TO authenticated;

-- Apply the default to every tenant table so inserts don't need to specify homestead_id.
DO $$
DECLARE
  tbls text[] := ARRAY[
    'animals','animal_events','backups','barter_contacts','barter_deals','barter_items',
    'bills','breeding_decisions','chore_assignments','chore_completions','chores',
    'compost_entries','contacts','feed_container_stock','feed_containers','feed_items',
    'feed_logs','feed_purchases','feed_units','garden_plots','health_records','heat_events',
    'income_entries','incubations','litters','pens','pregnancies','production_logs',
    'tasks','weight_logs'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN homestead_id SET DEFAULT public.current_homestead_id()', t);
  END LOOP;
END $$;
